"""Clinic invoicing API with optional Stripe payment link generation."""

import json
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.invoice import (
    INV_STATUS_DRAFT,
    INV_STATUS_PAID,
    INV_STATUS_SENT,
    INV_STATUS_VOID,
    InvoiceRecord,
)
from app.models.user import UserRecord
from app.services import email as email_svc

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description:    str
    quantity:       float = 1.0
    unit_gbp:       float


class InvoiceCreate(BaseModel):
    client_id:      str | None = None
    client_name:    str
    client_email:   str
    description:    str
    line_items:     list[LineItem] | None = None
    amount_gbp:     float | None = None       # ignored if line_items given
    vat_rate:       float = 0.0               # 0.0 or 0.20
    due_days:       int = 30
    notes:          str | None = None


class InvoiceUpdate(BaseModel):
    description:    str | None = None
    notes:          str | None = None
    vat_rate:       float | None = None


class MarkPaidBody(BaseModel):
    payment_reference: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clinic_id_from_user(user: UserRecord) -> str:
    return user.clinic_id or user.organization_id or "unknown"


def _calc_amount(body: InvoiceCreate) -> float:
    if body.line_items:
        return sum(li.quantity * li.unit_gbp for li in body.line_items)
    if body.amount_gbp is not None:
        return body.amount_gbp
    raise HTTPException(400, detail="Provide line_items or amount_gbp")


def _next_invoice_number(db: Session, clinic_id: str) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(InvoiceRecord).filter(InvoiceRecord.clinic_id == clinic_id).count()
    return f"{year}-{count + 1:04d}"


def _create_stripe_payment_link(invoice: InvoiceRecord) -> str | None:
    """Return a Stripe payment link URL, or None if Stripe is not configured."""
    secret_key = os.getenv("STRIPE_SECRET_KEY", "")
    if not secret_key:
        return None
    try:
        import stripe  # type: ignore[import-untyped]
        stripe.api_key = secret_key
        amount_pence = int(round(invoice.total_gbp * 100))
        price = stripe.Price.create(
            currency="gbp",
            unit_amount=amount_pence,
            product_data={"name": invoice.description[:200]},
        )
        link = stripe.PaymentLink.create(
            line_items=[{"price": price.id, "quantity": 1}],
            metadata={
                "invoice_id": invoice.id,
                "clinic_id": invoice.clinic_id,
                "client_email": invoice.client_email,
            },
        )
        return link.url
    except Exception:  # noqa: BLE001
        return None


def _send_invoice_email(invoice: InvoiceRecord) -> None:
    try:
        payment_section = ""
        if invoice.stripe_payment_link:
            payment_section = f"\nPay securely online: {invoice.stripe_payment_link}\n"

        due_str = ""
        if invoice.due_date:
            due_str = f"\nPayment due: {invoice.due_date.strftime('%d %B %Y')}"

        email_svc.send_generic_notification(
            to_email=invoice.client_email,
            subject=f"Invoice {invoice.invoice_number} from Neuro Flow — £{invoice.total_gbp:.2f}",
            body=(
                f"Dear {invoice.client_name},\n\n"
                f"Please find your invoice below.\n\n"
                f"Invoice: {invoice.invoice_number}\n"
                f"Description: {invoice.description}\n"
                f"Amount: £{invoice.amount_gbp:.2f}"
                + (f" + VAT (20%) = £{invoice.total_gbp:.2f}" if invoice.vat_rate else "")
                + due_str
                + payment_section
                + (f"\n\nNotes: {invoice.notes}" if invoice.notes else "")
                + "\n\nThank you,\nNeuro Flow Clinical Team"
            ),
        )
    except Exception:  # noqa: BLE001
        pass  # email failure must not block send action


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/stats")
def invoice_stats(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Revenue summary KPIs for dashboard widgets."""
    clinic_id = _clinic_id_from_user(user)
    q = db.query(InvoiceRecord)
    if user.role != "super-platform-admin":
        q = q.filter(InvoiceRecord.clinic_id == clinic_id)
    rows = q.all()
    now = datetime.now(timezone.utc)
    # Auto-mark overdue (sent + past due_date) — lightweight side-effect
    updated = False
    for r in rows:
        if r.status == INV_STATUS_SENT and r.due_date and r.due_date < now:
            r.status = "overdue"
            updated = True
    if updated:
        db.commit()
    total_billed    = sum(r.total_gbp for r in rows if r.status != INV_STATUS_VOID)
    total_paid      = sum(r.total_gbp for r in rows if r.status == INV_STATUS_PAID)
    total_outstanding = sum(r.total_gbp for r in rows if r.status == INV_STATUS_SENT)
    total_overdue   = sum(r.total_gbp for r in rows if r.status == "overdue")
    return {
        "total_billed":      round(total_billed, 2),
        "total_paid":        round(total_paid, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_overdue":     round(total_overdue, 2),
        "count_draft":       sum(1 for r in rows if r.status == INV_STATUS_DRAFT),
        "count_sent":        sum(1 for r in rows if r.status == INV_STATUS_SENT),
        "count_paid":        sum(1 for r in rows if r.status == INV_STATUS_PAID),
        "count_overdue":     sum(1 for r in rows if r.status == "overdue"),
    }


@router.get("/")
def list_invoices(
    status: str | None = None,
    client_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    clinic_id = _clinic_id_from_user(user)
    q = db.query(InvoiceRecord)
    if user.role != "super-platform-admin":
        q = q.filter(InvoiceRecord.clinic_id == clinic_id)
    if status:
        q = q.filter(InvoiceRecord.status == status)
    if client_id:
        q = q.filter(InvoiceRecord.client_id == client_id)
    rows = q.order_by(InvoiceRecord.created_at.desc()).all()
    return {"items": [r.to_dict() for r in rows], "total": len(rows)}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_invoice(
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    clinic_id = _clinic_id_from_user(user)
    amount = _calc_amount(body)
    invoice_number = _next_invoice_number(db, clinic_id)
    now = datetime.now(timezone.utc)

    record = InvoiceRecord(
        clinic_id=clinic_id,
        client_id=body.client_id,
        client_name=body.client_name,
        client_email=body.client_email,
        invoice_number=invoice_number,
        description=body.description,
        line_items_json=json.dumps([li.model_dump() for li in body.line_items]) if body.line_items else None,
        amount_gbp=amount,
        vat_rate=body.vat_rate,
        invoice_date=now,
        due_date=now + timedelta(days=body.due_days),
        notes=body.notes,
        created_by=user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    record = _get_or_404(db, invoice_id)
    _check_clinic(record, user)
    return record.to_dict()


@router.patch("/{invoice_id}")
def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    record = _get_or_404(db, invoice_id)
    _check_clinic(record, user)
    if record.status not in (INV_STATUS_DRAFT,):
        raise HTTPException(400, detail="Only draft invoices can be updated")
    if body.description is not None:
        record.description = body.description
    if body.notes is not None:
        record.notes = body.notes
    if body.vat_rate is not None:
        record.vat_rate = body.vat_rate
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.post("/{invoice_id}/send")
def send_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Send invoice email to client and optionally generate a Stripe payment link."""
    record = _get_or_404(db, invoice_id)
    _check_clinic(record, user)
    if record.status == INV_STATUS_VOID:
        raise HTTPException(400, detail="Cannot send a voided invoice")

    if not record.stripe_payment_link:
        link = _create_stripe_payment_link(record)
        if link:
            record.stripe_payment_link = link

    _send_invoice_email(record)

    record.status = INV_STATUS_SENT
    record.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.post("/{invoice_id}/mark-paid")
def mark_paid(
    invoice_id: str,
    body: MarkPaidBody,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    record = _get_or_404(db, invoice_id)
    _check_clinic(record, user)
    if record.status == INV_STATUS_VOID:
        raise HTTPException(400, detail="Cannot mark a voided invoice as paid")

    record.status = INV_STATUS_PAID
    record.paid_at = datetime.now(timezone.utc)
    if body.payment_reference:
        record.stripe_payment_intent = body.payment_reference
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.post("/{invoice_id}/void")
def void_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    record = _get_or_404(db, invoice_id)
    _check_clinic(record, user)
    if record.status == INV_STATUS_PAID:
        raise HTTPException(400, detail="Cannot void a paid invoice. Use a credit note instead.")

    record.status = INV_STATUS_VOID
    db.commit()
    db.refresh(record)
    return record.to_dict()


# ── Private helpers ────────────────────────────────────────────────────────────

def _get_or_404(db: Session, invoice_id: str) -> InvoiceRecord:
    r = db.query(InvoiceRecord).filter(InvoiceRecord.id == invoice_id).first()
    if not r:
        raise HTTPException(404, detail="Invoice not found")
    return r


def _check_clinic(record: InvoiceRecord, user: UserRecord) -> None:
    if user.role == "super-platform-admin":
        return
    clinic_id = user.clinic_id or user.organization_id or ""
    if record.clinic_id != clinic_id:
        raise HTTPException(403, detail="Access denied")
