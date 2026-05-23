from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.booking import BookingWebhookPayload
from app.models.client import ClientRecord
from app.services import email as email_svc
from app.services.booking_service import BookingService
from app.services.meeting_links import assessment_meeting_url

router = APIRouter()
service = BookingService()


class ConfirmSessionBody(BaseModel):
    """Confirm a booked assessment slot and email client + clinician with the video link."""

    client_id: str
    clinician_email: EmailStr
    clinician_name: str = "Clinician"
    slot_time: str


@router.get("/")
def list_bookings() -> dict[str, object]:
    return {"items": service.list_bookings()}


@router.post("/confirm-session")
def confirm_assessment_session(payload: ConfirmSessionBody, db: Session = Depends(get_db)) -> dict[str, object]:
    """Generate video meeting URL (see STATIC_VIDEO_MEETING_URL or Jitsi) and send SendGrid confirmations."""
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


@router.post("/webhooks/stripe")
def stripe_booking_webhook(payload: BookingWebhookPayload) -> dict[str, object]:
    booking = service.process_payment_webhook(payload)
    return {
        "message": "Booking workflow started",
        "booking": booking.model_dump(),
    }


@router.get("/{booking_id}")
def get_booking(booking_id: str) -> dict[str, object]:
    booking = service.get_booking(booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    return booking.model_dump()
