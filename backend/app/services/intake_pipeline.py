"""
Shared intake automation pipeline.

Called by both intake paths:
  • Per-clinic inbound webhook  (POST /intake/webhook/{clinic_id})
  • API key REST intake          (POST /intake/client  with X-API-Key header)

Chain:
  1. Create ClientRecord (de-duplication by email+clinic_id)
  2. Create InvoiceRecord (status=paid — payment already confirmed upstream)
  3. Dispatch FORM_BASIC_INTAKE → sends welcome + invoice email to client
  4. Dispatch pathway questionnaire (self-report / parent / adolescent)
  5. Dispatch GP form if GP email provided
  6. Dispatch teacher form if teacher email provided (child/adolescent only)
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.client import ClientRecord
from app.models.invoice import INV_STATUS_PAID, InvoiceRecord
from app.models.form_token import (
    FORM_ADULT_GP,
    FORM_ADULT_SELF,
    FORM_ADOLESCENT_GP,
    FORM_ADOLESCENT_SELF,
    FORM_ADOLESCENT_TEACHER,
    FORM_BASIC_INTAKE,
    FORM_CHILD_GP,
    FORM_CHILD_PARENT,
    FORM_CHILD_TEACHER,
    STATUS_PENDING,
    FormToken,
    generate_token,
)
from app.services import email as email_svc


# ── Input schema ──────────────────────────────────────────────────────────────


@dataclass
class IntakePayload:
    """Normalised client data, regardless of which intake path produced it."""

    clinic_id: str
    full_name: str
    email: str
    pathway: str  # e.g. "Adult ADHD", "Child Autism"
    age_group: str  # "Adult" | "Adolescent" | "Child"
    phone: str = ""
    amount_paid: float = 0.0
    currency: str = "GBP"
    paid_service_name: str = ""
    child_name: Optional[str] = None
    child_dob: Optional[str] = None  # ISO YYYY-MM-DD
    gp_name: Optional[str] = None
    gp_email: Optional[str] = None
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    source: str = "webhook"  # "webhook" | "api" | "manual"
    external_ref: Optional[str] = None  # order ID / session ID from sender


# ── Result ────────────────────────────────────────────────────────────────────


@dataclass
class IntakeResult:
    client: ClientRecord
    invoice: InvoiceRecord
    forms_sent: list[str] = field(default_factory=list)  # form_type strings dispatched


# ── Helper: pathway → form set ────────────────────────────────────────────────


def _forms_for_pathway(
    age_group: str, gp_email: str | None, teacher_email: str | None
) -> list[tuple[str, str | None]]:
    """
    Return a list of (form_type, recipient_email_or_None) for a given age group.
    recipient_email=None means 'send to client'.
    """
    forms: list[tuple[str, str | None]] = []

    if age_group == "Adult":
        forms.append((FORM_ADULT_SELF, None))
        if gp_email:
            forms.append((FORM_ADULT_GP, gp_email))

    elif age_group == "Adolescent":
        forms.append((FORM_ADOLESCENT_SELF, None))
        if teacher_email:
            forms.append((FORM_ADOLESCENT_TEACHER, teacher_email))
        if gp_email:
            forms.append((FORM_ADOLESCENT_GP, gp_email))

    elif age_group == "Child":
        forms.append((FORM_CHILD_PARENT, None))
        if teacher_email:
            forms.append((FORM_CHILD_TEACHER, teacher_email))
        if gp_email:
            forms.append((FORM_CHILD_GP, gp_email))

    return forms


def _next_invoice_number(db: Session, clinic_id: str) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(InvoiceRecord).filter(InvoiceRecord.clinic_id == clinic_id).count()
    return f"{year}-{count + 1:04d}"


def _platform_url() -> str:
    from app.core.config import settings

    return getattr(settings, "platform_base_url", "http://localhost:3004")


def _dispatch_form_record(
    db: Session,
    client: ClientRecord,
    form_type: str,
    recipient_email: str,
    recipient_name: str,
    invoice: InvoiceRecord,
) -> FormToken:
    token = generate_token()
    form_url = f"{_platform_url()}/forms/{token}"

    record = FormToken(
        id=str(uuid.uuid4()),
        token=token,
        client_id=client.id,
        form_type=form_type,
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        status=STATUS_PENDING,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.flush()  # get record persisted before sending email (avoids orphan tokens)

    if form_type == FORM_BASIC_INTAKE:
        email_svc.send_welcome_and_forms(
            to_email=recipient_email,
            client_id=client.id,
            client_name=client.full_name,
            assessment_type=client.pathway or "",
            form_url=form_url,
            amount=str(invoice.amount_gbp),
            currency=invoice.amount_gbp and "GBP" or "GBP",
            reference=invoice.invoice_number or invoice.id,
        )
    elif form_type in (FORM_CHILD_PARENT, FORM_ADOLESCENT_SELF, FORM_ADULT_SELF):
        email_svc.send_secondary_intake_form(
            to_email=recipient_email,
            client_id=client.id,
            client_name=client.full_name,
            pathway_label=client.pathway or "",
            form_url=form_url,
            paid_service_name=client.paid_service_name,
        )
    else:
        from app.models.form_token import FORM_TYPE_LABELS

        email_svc.send_third_party_form(
            to_email=recipient_email,
            client_id=client.id,
            recipient_name=recipient_name,
            client_name=client.full_name,
            form_type_label=FORM_TYPE_LABELS.get(form_type, form_type),
            form_url=form_url,
        )

    return record


# ── Main pipeline ─────────────────────────────────────────────────────────────


def run_intake_pipeline(db: Session, payload: IntakePayload) -> IntakeResult:
    """
    Execute the full intake automation chain.

    De-duplication: if a client with the same email already exists in this
    clinic, the existing record is returned and NO new invoice/forms are sent.
    Callers should check `result.forms_sent` — an empty list means the client
    was a duplicate.
    """
    # ── 1. De-duplicate ───────────────────────────────────────────────────────
    existing = (
        db.query(ClientRecord)
        .filter(
            ClientRecord.email == payload.email.lower().strip(),
            ClientRecord.clinic_id == payload.clinic_id,
        )
        .first()
    )
    if existing:
        # Return the existing client without re-sending anything
        dummy_inv = (
            db.query(InvoiceRecord)
            .filter(InvoiceRecord.client_id == existing.id)
            .first()
        )
        return IntakeResult(
            client=existing,
            invoice=dummy_inv or _make_stub_invoice(existing),
            forms_sent=[],
        )

    # ── 2. Create client ──────────────────────────────────────────────────────
    client_id = f"CLI-{uuid.uuid4().hex[:8].upper()}"
    assessment_id = f"ASS-{uuid.uuid4().hex[:8].upper()}"

    client = ClientRecord(
        id=client_id,
        clinic_id=payload.clinic_id,
        full_name=payload.full_name.strip(),
        email=payload.email.lower().strip(),
        phone=payload.phone or "",
        pathway=payload.pathway,
        age_group=payload.age_group,
        child_name=payload.child_name,
        child_dob=payload.child_dob,
        status="New",
        stage="Intake",
        source=payload.source,
        assessment_id=assessment_id,
        payment_amount=str(payload.amount_paid) if payload.amount_paid else None,
        payment_currency=payload.currency,
        paid_service_name=payload.paid_service_name or payload.pathway,
        created_at=datetime.now(timezone.utc),
    )
    db.add(client)
    db.flush()

    # ── 3. Create invoice (status=paid — payment already confirmed) ───────────
    inv_number = _next_invoice_number(db, payload.clinic_id)
    amount = payload.amount_paid or 0.0

    invoice = InvoiceRecord(
        clinic_id=payload.clinic_id,
        client_id=client.id,
        client_name=client.full_name,
        client_email=client.email,
        invoice_number=inv_number,
        description=payload.paid_service_name
        or payload.pathway
        or "Assessment service",
        line_items_json=json.dumps(
            [
                {
                    "description": payload.paid_service_name or payload.pathway,
                    "quantity": 1,
                    "unit_gbp": amount,
                }
            ]
        ),
        amount_gbp=amount,
        vat_rate=0.0,
        status=INV_STATUS_PAID,
        invoice_date=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc),
        paid_at=datetime.now(timezone.utc),
    )
    db.add(invoice)
    db.flush()

    # ── 4. Send welcome + invoice email (FORM_BASIC_INTAKE) ───────────────────
    forms_sent: list[str] = []

    _dispatch_form_record(
        db=db,
        client=client,
        form_type=FORM_BASIC_INTAKE,
        recipient_email=client.email,
        recipient_name=client.full_name,
        invoice=invoice,
    )
    forms_sent.append(FORM_BASIC_INTAKE)

    # ── 5. Pathway questionnaire + GP / teacher forms ─────────────────────────
    for form_type, third_party_email in _forms_for_pathway(
        payload.age_group, payload.gp_email, payload.teacher_email
    ):
        if third_party_email:
            # Third-party (GP / teacher)
            third_party_name = (
                payload.gp_name if "gp" in form_type else payload.teacher_name
            ) or third_party_email
            _dispatch_form_record(
                db=db,
                client=client,
                form_type=form_type,
                recipient_email=third_party_email,
                recipient_name=third_party_name,
                invoice=invoice,
            )
        else:
            # Client self-report / parent form
            recipient_name = (
                payload.child_name
                if payload.child_name and payload.age_group == "Child"
                else client.full_name
            )
            _dispatch_form_record(
                db=db,
                client=client,
                form_type=form_type,
                recipient_email=client.email,
                recipient_name=recipient_name,
                invoice=invoice,
            )
        forms_sent.append(form_type)

    db.commit()
    db.refresh(client)

    return IntakeResult(client=client, invoice=invoice, forms_sent=forms_sent)


def _make_stub_invoice(client: ClientRecord) -> InvoiceRecord:
    """Return an unsaved stub invoice for duplicate-client responses."""
    inv = InvoiceRecord.__new__(InvoiceRecord)
    inv.id = f"INV-STUB-{client.id}"
    inv.invoice_number = "—"
    inv.amount_gbp = 0.0
    return inv
