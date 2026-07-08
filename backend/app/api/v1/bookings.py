import json
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.booking import BookingWebhookPayload
from app.models.client import ClientRecord
from app.models.user import UserRecord
from app.models.invoice import InvoiceRecord
from app.services import email as email_svc
from app.services.booking_service import BookingService
from app.services.meeting_links import assessment_meeting_url

router = APIRouter()
service = BookingService()


# ── Auto-invoice helper ───────────────────────────────────────────────────────

def _auto_invoice_for_booking(db: Session, clinic_id: int, client_id: int,
                               booking_ref: str, amount_gbp: float = 0.0,
                               description: str = "Assessment appointment") -> InvoiceRecord | None:
    """Create an invoice automatically when a booking is marked complete."""
    try:
        line_items = [{"description": description, "quantity": 1, "unit_price": amount_gbp}]
        inv = InvoiceRecord(
            clinic_id=clinic_id,
            client_id=client_id,
            booking_ref=booking_ref,
            amount_gbp=amount_gbp,
            vat_rate=0.0,          # medical services are VAT-exempt
            status="draft",
            due_date=date.today() + timedelta(days=14),
            line_items_json=json.dumps(line_items),
            description=description,
            issued_at=datetime.utcnow(),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        return inv
    except Exception:
        return None


class ConfirmSessionBody(BaseModel):
    """Confirm a booked assessment slot and email client + clinician with the video link."""

    client_id: str
    clinician_email: EmailStr
    clinician_name: str = "Clinician"
    slot_time: str


@router.get("/")
def list_bookings(
    db: Session = Depends(get_db),
    _user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    return {"items": service.list_bookings(db)}


@router.post("/confirm-session")
def confirm_assessment_session(payload: ConfirmSessionBody, db: Session = Depends(get_db)) -> dict:
    """Generate video meeting URL and send SendGrid confirmations."""
    client = db.query(ClientRecord).filter(ClientRecord.id == payload.client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    assessment_ref = client.assessment_id or client.id
    video_url = assessment_meeting_url(assessment_ref)
    pathway = client.pathway or "Assessment"

    ok_client = email_svc.send_booking_confirmation_client(
        to_email=client.email,
        client_id=client.id,
        client_name=client.full_name,
        pathway=pathway,
        slot_time=payload.slot_time,
        video_meeting_url=video_url,
        clinician_name=payload.clinician_name,
    )
    ok_clinician = email_svc.send_booking_confirmation_clinician(
        to_email=str(payload.clinician_email),
        client_id=client.id,
        clinician_name=payload.clinician_name,
        client_name=client.full_name,
        pathway=pathway,
        slot_time=payload.slot_time,
        video_meeting_url=video_url,
    )

    return {
        "video_meeting_url": video_url,
        "emails": {"client_sent": ok_client, "clinician_sent": ok_clinician},
    }


class CompleteSessionBody(BaseModel):
    booking_id: str
    client_id: int
    auto_invoice: bool = True
    invoice_amount_gbp: float = 0.0
    invoice_description: str = "Assessment appointment"


@router.post("/complete-session")
def complete_session(
    payload: CompleteSessionBody,
    db: Session = Depends(get_db),
    _user: UserRecord = Depends(require_roles("clinical-admin", "clinician", "super-platform-admin")),
) -> dict:
    """Mark a session complete and optionally auto-generate an invoice."""
    clinic_id = getattr(_user, "clinic_id", 1) or 1
    invoice = None
    if payload.auto_invoice:
        invoice = _auto_invoice_for_booking(
            db, clinic_id, payload.client_id,
            payload.booking_id,
            payload.invoice_amount_gbp,
            payload.invoice_description,
        )
    return {
        "booking_id": payload.booking_id,
        "status": "completed",
        "invoice_created": invoice is not None,
        "invoice_id": invoice.id if invoice else None,
    }


@router.post("/webhooks/stripe")
def stripe_booking_webhook(payload: BookingWebhookPayload, db: Session = Depends(get_db)) -> dict:
    booking = service.process_payment_webhook(payload, db)
    return {
        "message": "Booking workflow started",
        "booking": booking.model_dump(),
    }


@router.get("/{booking_id}")
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    _user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    booking = service.get_booking(booking_id, db)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking.model_dump()
