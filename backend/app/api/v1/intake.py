"""
Intake API — two paths that both run the same automation pipeline.

─────────────────────────────────────────────────────────────────────────────
PATH 1 — Per-clinic inbound webhook
  POST /api/v1/intake/webhook/{clinic_id}
  No auth header. Secured by HMAC-SHA256 signature in X-Webhook-Signature.
  Supports payload formats: woocommerce | stripe | cliniko | acuity | generic

PATH 2 — API key REST intake
  POST /api/v1/intake/client
  Header:  X-API-Key: nf_live_...
  Body:    IntakeClientBody (JSON)

MANAGEMENT (staff-auth required)
  GET    /api/v1/intake/webhooks           — list this clinic's webhook configs
  POST   /api/v1/intake/webhooks           — register a new webhook config
  DELETE /api/v1/intake/webhooks/{id}      — delete a webhook config
  GET    /api/v1/intake/webhooks/{id}/test — send a test event to the pipeline
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles, get_api_key_clinic
from app.models.clinic_webhook_config import ClinicWebhookConfig
from app.models.user import UserRecord
from app.services.intake_pipeline import (
    IntakePayload,
    IntakeResult,
    run_intake_pipeline,
)
from app.services.tenant import effective_clinic_id

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ══════════════════════════════════════════════════════════════════════════════

_PATHWAY_RULES: list[tuple[str, str, str]] = [
    # (keyword, pathway_label, age_group)
    ("child adhd autism", "Child ADHD + Autism", "Child"),
    ("adult adhd autism", "Adult ADHD + Autism", "Adult"),
    ("child adhd", "Child ADHD", "Child"),
    ("child autism", "Child Autism", "Child"),
    ("adult autism", "Adult Autism", "Adult"),
    ("adult adhd", "Adult ADHD", "Adult"),
    ("adhd autism", "Adult ADHD + Autism", "Adult"),
    ("autism", "Adult Autism", "Adult"),
    ("adhd", "Adult ADHD", "Adult"),
]
_PATHWAY_RULES.sort(key=lambda t: len(t[0]), reverse=True)


def _detect_pathway(text: str) -> tuple[str, str]:
    """Return (pathway_label, age_group) from free-text product/service name."""
    lowered = re.sub(r"[^\w\s]", " ", text.lower())
    for keyword, label, age_group in _PATHWAY_RULES:
        if keyword in lowered:
            return label, age_group
    return "Adult ADHD", "Adult"


def _age_from_dob(dob_str: str | None) -> int | None:
    if not dob_str:
        return None
    try:
        dob = date.fromisoformat(str(dob_str).strip()[:10])
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except (ValueError, TypeError):
        return None


def _age_group_from_age(age: int | None) -> str:
    if age is None:
        return "Adult"
    if age <= 10:
        return "Child"
    if age <= 17:
        return "Adolescent"
    return "Adult"


# ══════════════════════════════════════════════════════════════════════════════
# Payload normalisers — map each format to IntakePayload
# ══════════════════════════════════════════════════════════════════════════════


def _normalise_woocommerce(body: dict, clinic_id: str) -> IntakePayload:
    billing = body.get("billing", {})
    first = billing.get("first_name", "")
    last = billing.get("last_name", "")
    name = f"{first} {last}".strip() or billing.get("company", "Unknown")
    email = billing.get("email", "")
    phone = billing.get("phone", "")

    items = body.get("line_items", [])
    product_text = " ".join(i.get("name", "") for i in items)
    pathway, age_group = _detect_pathway(product_text or body.get("status", ""))

    try:
        amount = float(body.get("total", 0))
    except (ValueError, TypeError):
        amount = 0.0
    currency = body.get("currency", "GBP").upper()

    service_name = (items[0].get("name") if items else None) or pathway

    meta = body.get("meta_data", [])
    child_dob = next(
        (m.get("value") for m in meta if m.get("key") == "child_dob"), None
    )
    child_name = next(
        (m.get("value") for m in meta if m.get("key") == "child_name"), None
    )

    if child_dob:
        age = _age_from_dob(child_dob)
        age_group = _age_group_from_age(age)

    return IntakePayload(
        clinic_id=clinic_id,
        full_name=name,
        email=email,
        phone=phone,
        pathway=pathway,
        age_group=age_group,
        amount_paid=amount,
        currency=currency,
        paid_service_name=service_name,
        child_name=child_name,
        child_dob=child_dob,
        source="webhook",
        external_ref=str(body.get("id", "")),
    )


def _normalise_stripe(body: dict, clinic_id: str) -> IntakePayload:
    obj = body.get("data", {}).get("object", body)
    meta = obj.get("metadata", {})
    cd = obj.get("customer_details", {})

    name = (
        meta.get("client_name") or meta.get("full_name") or cd.get("name") or "Unknown"
    )
    email = cd.get("email") or meta.get("email") or ""
    phone = cd.get("phone") or meta.get("phone") or ""

    pathway_raw = meta.get("pathway") or meta.get("product_name") or ""
    pathway, age_group = _detect_pathway(pathway_raw)
    if meta.get("age_group") in ("Adult", "Adolescent", "Child"):
        age_group = meta["age_group"]

    child_dob = meta.get("child_dob")
    child_name = meta.get("child_name") or meta.get("child_first_name")
    if child_dob:
        age = _age_from_dob(child_dob)
        age_group = _age_group_from_age(age)

    try:
        amount = float(obj.get("amount_total", 0)) / 100  # Stripe sends pence
    except (ValueError, TypeError):
        amount = 0.0
    currency = (obj.get("currency") or "gbp").upper()

    return IntakePayload(
        clinic_id=clinic_id,
        full_name=name,
        email=email,
        phone=phone,
        pathway=pathway,
        age_group=age_group,
        amount_paid=amount,
        currency=currency,
        paid_service_name=pathway_raw or pathway,
        child_name=child_name,
        child_dob=child_dob,
        gp_email=meta.get("gp_email"),
        gp_name=meta.get("gp_name"),
        teacher_email=meta.get("teacher_email"),
        teacher_name=meta.get("teacher_name"),
        source="webhook",
        external_ref=obj.get("id"),
    )


def _normalise_cliniko(body: dict, clinic_id: str) -> IntakePayload:
    """Cliniko appointment.created / patient.created webhook."""
    patient = body.get("patient", body)
    first = patient.get("first_name", "")
    last = patient.get("last_name", "")
    name = f"{first} {last}".strip() or "Unknown"
    email = patient.get("email", "")
    phone = (
        patient.get("patient_phone_numbers", [{}])[0].get("number", "")
        if patient.get("patient_phone_numbers")
        else ""
    )

    appointment = body.get("appointment", {})
    notes = appointment.get("notes") or appointment.get("appointment_type", {}).get(
        "name", ""
    )
    pathway, age_group = _detect_pathway(notes or appointment.get("name", ""))

    return IntakePayload(
        clinic_id=clinic_id,
        full_name=name,
        email=email,
        phone=phone,
        pathway=pathway,
        age_group=age_group,
        amount_paid=0.0,
        source="webhook",
        external_ref=str(patient.get("id", "")),
    )


def _normalise_acuity(body: dict, clinic_id: str) -> IntakePayload:
    """Acuity Scheduling appointment.scheduled webhook."""
    name = (
        f"{body.get('firstName', '')} {body.get('lastName', '')}".strip() or "Unknown"
    )
    email = body.get("email", "")
    phone = body.get("phone", "")
    appt_type = body.get("type", "")
    notes = body.get("notes", "")
    pathway, age_group = _detect_pathway(appt_type or notes)

    try:
        amount = float(body.get("price", 0))
    except (ValueError, TypeError):
        amount = 0.0

    forms_data = {
        f.get("name", ""): f.get("value", "")
        for f in body.get("forms", [{}])[0].get("values", [])
        if isinstance(f, dict)
    }

    return IntakePayload(
        clinic_id=clinic_id,
        full_name=name,
        email=email,
        phone=phone,
        pathway=pathway,
        age_group=age_group,
        amount_paid=amount,
        currency="GBP",
        paid_service_name=appt_type or pathway,
        gp_email=forms_data.get("GP Email"),
        gp_name=forms_data.get("GP Name"),
        teacher_email=forms_data.get("Teacher Email"),
        teacher_name=forms_data.get("Teacher Name"),
        source="webhook",
        external_ref=str(body.get("id", "")),
    )


def _normalise_generic(body: dict, clinic_id: str) -> IntakePayload:
    """
    Generic / Zapier payload.  Accepted field names (all optional except email):
      full_name | name, email, phone, pathway, age_group,
      amount | amount_paid | price, currency, paid_service_name | service_name | product_name,
      child_name, child_dob, gp_email, gp_name, teacher_email, teacher_name
    """
    name = body.get("full_name") or body.get("name") or "Unknown"
    email = body.get("email", "")
    phone = body.get("phone") or body.get("telephone") or ""

    raw_pathway = (
        body.get("pathway")
        or body.get("paid_service_name")
        or body.get("service_name")
        or body.get("product_name")
        or ""
    )
    pathway, age_group = _detect_pathway(raw_pathway)
    if body.get("age_group") in ("Adult", "Adolescent", "Child"):
        age_group = body["age_group"]

    child_dob = body.get("child_dob")
    if child_dob:
        age_group = _age_group_from_age(_age_from_dob(child_dob))

    try:
        amount = float(
            body.get("amount") or body.get("amount_paid") or body.get("price") or 0
        )
    except (ValueError, TypeError):
        amount = 0.0

    return IntakePayload(
        clinic_id=clinic_id,
        full_name=name,
        email=email,
        phone=phone,
        pathway=pathway,
        age_group=age_group,
        amount_paid=amount,
        currency=(body.get("currency") or "GBP").upper(),
        paid_service_name=raw_pathway or pathway,
        child_name=body.get("child_name"),
        child_dob=child_dob,
        gp_email=body.get("gp_email"),
        gp_name=body.get("gp_name"),
        teacher_email=body.get("teacher_email"),
        teacher_name=body.get("teacher_name"),
        source="webhook",
        external_ref=body.get("external_ref") or body.get("order_id") or body.get("id"),
    )


_NORMALISERS = {
    "woocommerce": _normalise_woocommerce,
    "stripe": _normalise_stripe,
    "cliniko": _normalise_cliniko,
    "acuity": _normalise_acuity,
    "generic": _normalise_generic,
}


# ══════════════════════════════════════════════════════════════════════════════
# Signature verification
# ══════════════════════════════════════════════════════════════════════════════


def _verify_hmac(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret:
        return False
    # Accept both raw hex and "sha256=<hex>" formats (WooCommerce sends the latter)
    sig = signature.removeprefix("sha256=")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def _verify_stripe_signature(body: bytes, sig_header: str | None, secret: str) -> bool:
    if not sig_header or not secret:
        return False
    try:
        pairs = dict(p.split("=", 1) for p in sig_header.split(","))
        timestamp = pairs.get("t", "")
        v1 = pairs.get("v1", "")
        signed_payload = f"{timestamp}.".encode() + body
        expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════════════════════
# Response schemas
# ══════════════════════════════════════════════════════════════════════════════


class WebhookConfigOut(BaseModel):
    id: str
    label: str
    payload_format: str
    active: bool
    events_received: int
    last_event_at: Optional[datetime]
    created_at: datetime
    webhook_url: str  # computed — not stored in DB


class WebhookConfigCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    payload_format: str = Field(
        "generic", pattern="^(woocommerce|stripe|cliniko|acuity|generic)$"
    )


class WebhookConfigCreated(WebhookConfigOut):
    signing_secret: str  # shown ONCE at creation


class IntakeClientBody(BaseModel):
    """Body for the API key REST intake endpoint."""

    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    pathway: str = Field(..., min_length=2, max_length=120)
    phone: str = ""
    amount_paid: float = 0.0
    currency: str = "GBP"
    paid_service_name: str = ""
    child_name: Optional[str] = None
    child_dob: Optional[str] = None
    gp_email: Optional[str] = None
    gp_name: Optional[str] = None
    teacher_email: Optional[str] = None
    teacher_name: Optional[str] = None
    external_ref: Optional[str] = None


class IntakeResponse(BaseModel):
    client_id: str
    assessment_id: str
    pathway: str
    forms_sent: list[str]
    invoice_id: str
    duplicate: bool


def _config_to_out(cfg: ClinicWebhookConfig, base_url: str) -> WebhookConfigOut:
    return WebhookConfigOut(
        id=cfg.id,
        label=cfg.label,
        payload_format=cfg.payload_format,
        active=cfg.active,
        events_received=cfg.events_received,
        last_event_at=cfg.last_event_at,
        created_at=cfg.created_at,
        webhook_url=f"{base_url}/api/v1/intake/webhook/{cfg.clinic_id}",
    )


def _base_url(request: Request) -> str:
    from app.core.config import settings

    return settings.platform_base_url or str(request.base_url).rstrip("/")


# ══════════════════════════════════════════════════════════════════════════════
# PATH 1 — Inbound webhook receiver
# ══════════════════════════════════════════════════════════════════════════════


@router.post("/webhook/{clinic_id}", status_code=200)
async def receive_webhook(
    clinic_id: str,
    request: Request,
    x_webhook_signature: str | None = Header(default=None),
    x_wc_webhook_signature: str | None = Header(default=None),
    stripe_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """
    Receive a payment/booking event from the clinic's platform and run the
    full intake pipeline (create client → invoice → forms → tracking).
    """
    cfg = (
        db.query(ClinicWebhookConfig)
        .filter(
            ClinicWebhookConfig.clinic_id == clinic_id,
            ClinicWebhookConfig.active == True,  # noqa: E712
        )
        .first()
    )
    if not cfg:
        # Return 200 to avoid leaking whether the endpoint exists
        return {"received": False, "error": "no_config"}

    body = await request.body()

    # ── Signature verification ────────────────────────────────────────────────
    sig = x_webhook_signature or x_wc_webhook_signature
    if cfg.payload_format == "stripe":
        verified = _verify_stripe_signature(body, stripe_signature, cfg.signing_secret)
    else:
        verified = _verify_hmac(body, sig, cfg.signing_secret)

    if not verified:
        # Log and return 200 — never 401 (avoids enumeration)
        import logging

        logging.getLogger(__name__).warning(
            "Webhook signature mismatch clinic=%s config=%s", clinic_id, cfg.id
        )
        return {"received": False, "error": "signature_mismatch"}

    # ── Parse payload ─────────────────────────────────────────────────────────
    try:
        data = json.loads(body)
    except Exception:
        return {"received": False, "error": "invalid_json"}

    normaliser = _NORMALISERS.get(cfg.payload_format, _normalise_generic)
    try:
        intake_payload = normaliser(data, clinic_id)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("Webhook normalisation error: %s", exc)
        return {"received": False, "error": "normalisation_failed"}

    if not intake_payload.email:
        return {"received": False, "error": "missing_email"}

    # ── Run pipeline ──────────────────────────────────────────────────────────
    result: IntakeResult = run_intake_pipeline(db, intake_payload)

    # ── Update counters ───────────────────────────────────────────────────────
    cfg.events_received = (cfg.events_received or 0) + 1
    cfg.last_event_at = datetime.now(timezone.utc)
    db.add(cfg)
    db.commit()

    return {
        "received": True,
        "client_id": result.client.id,
        "assessment_id": result.client.assessment_id,
        "invoice_id": result.invoice.id,
        "forms_sent": result.forms_sent,
        "duplicate": len(result.forms_sent) == 0,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PATH 2 — API key REST intake
# ══════════════════════════════════════════════════════════════════════════════


@router.post("/client", response_model=IntakeResponse, status_code=201)
def intake_via_api_key(
    body: IntakeClientBody,
    db: Session = Depends(get_db),
    clinic_id: str = Depends(get_api_key_clinic),
) -> IntakeResponse:
    """
    Create a client and run the full intake pipeline using an API key.
    Header:  X-API-Key: nf_live_...
    """
    pathway, age_group = _detect_pathway(body.pathway)
    if body.child_dob:
        age_group = _age_group_from_age(_age_from_dob(body.child_dob))

    payload = IntakePayload(
        clinic_id=clinic_id,
        full_name=body.full_name,
        email=str(body.email),
        phone=body.phone,
        pathway=pathway,
        age_group=age_group,
        amount_paid=body.amount_paid,
        currency=body.currency.upper(),
        paid_service_name=body.paid_service_name or body.pathway,
        child_name=body.child_name,
        child_dob=body.child_dob,
        gp_email=body.gp_email,
        gp_name=body.gp_name,
        teacher_email=body.teacher_email,
        teacher_name=body.teacher_name,
        source="api",
        external_ref=body.external_ref,
    )

    result = run_intake_pipeline(db, payload)

    return IntakeResponse(
        client_id=result.client.id,
        assessment_id=result.client.assessment_id or "",
        pathway=result.client.pathway or pathway,
        forms_sent=result.forms_sent,
        invoice_id=result.invoice.id,
        duplicate=len(result.forms_sent) == 0,
    )


# ══════════════════════════════════════════════════════════════════════════════
# MANAGEMENT — webhook config CRUD (staff auth required)
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/webhooks", response_model=list[WebhookConfigOut])
def list_webhook_configs(
    request: Request,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> list[WebhookConfigOut]:
    clinic_id = effective_clinic_id(user)
    cfgs = (
        db.query(ClinicWebhookConfig)
        .filter(ClinicWebhookConfig.clinic_id == clinic_id)
        .order_by(ClinicWebhookConfig.created_at.desc())
        .all()
    )
    base = _base_url(request)
    return [_config_to_out(c, base) for c in cfgs]


@router.post("/webhooks", response_model=WebhookConfigCreated, status_code=201)
def create_webhook_config(
    body: WebhookConfigCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> WebhookConfigCreated:
    """
    Register a new per-clinic webhook.  The signing_secret is shown ONCE
    in this response — copy it immediately and configure it in the sending
    platform (WooCommerce / Stripe / Zapier / etc.).
    """
    clinic_id = effective_clinic_id(user)
    raw_secret = secrets.token_hex(32)  # 64-char hex signing secret

    cfg = ClinicWebhookConfig(
        clinic_id=clinic_id,
        label=body.label,
        payload_format=body.payload_format,
        signing_secret=raw_secret,
        active=True,
        events_received=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)

    out = _config_to_out(cfg, _base_url(request))
    return WebhookConfigCreated(**out.model_dump(), signing_secret=raw_secret)


@router.delete("/webhooks/{config_id}", status_code=204)
def delete_webhook_config(
    config_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> None:
    clinic_id = effective_clinic_id(user)
    cfg = (
        db.query(ClinicWebhookConfig)
        .filter(
            ClinicWebhookConfig.id == config_id,
            ClinicWebhookConfig.clinic_id == clinic_id,
        )
        .first()
    )
    if not cfg:
        raise HTTPException(status_code=404, detail="Webhook config not found")
    db.delete(cfg)
    db.commit()


@router.post("/webhooks/{config_id}/test", status_code=200)
def test_webhook_config(
    config_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> dict:
    """
    Fire a synthetic test event through the intake pipeline for this webhook
    config.  The test client email is marked test@ so it is identifiable.
    No real email is sent (test payload uses a synthetic address).
    """
    clinic_id = effective_clinic_id(user)
    cfg = (
        db.query(ClinicWebhookConfig)
        .filter(
            ClinicWebhookConfig.id == config_id,
            ClinicWebhookConfig.clinic_id == clinic_id,
        )
        .first()
    )
    if not cfg:
        raise HTTPException(status_code=404, detail="Webhook config not found")

    test_payload = IntakePayload(
        clinic_id=clinic_id,
        full_name="Test Patient (Webhook Test)",
        email=f"webhook-test-{uuid.uuid4().hex[:6]}@neuroflow.test",
        phone="07700000000",
        pathway="Adult ADHD",
        age_group="Adult",
        amount_paid=350.0,
        currency="GBP",
        paid_service_name="Adult ADHD Assessment (Test)",
        source="webhook_test",
        external_ref=f"TEST-{uuid.uuid4().hex[:8].upper()}",
    )

    result = run_intake_pipeline(db, test_payload)

    return {
        "test": True,
        "client_id": result.client.id,
        "forms_sent": result.forms_sent,
        "invoice_id": result.invoice.id,
    }
