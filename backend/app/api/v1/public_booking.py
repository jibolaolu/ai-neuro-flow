"""Unauthenticated client flows (booking link from email)."""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.client import ClientRecord
from app.models.clinician_availability import ClinicianAvailabilitySlotRecord
from app.models.user import UserRecord
from app.services import email as email_svc
from app.services.meeting_links import assessment_meeting_url

router = APIRouter()


def _add_working_days(start: datetime, days: int) -> datetime:
    """Return start + N working days (Monday-Friday, no bank holiday check)."""
    result = start
    added = 0
    while added < days:
        result += timedelta(days=1)
        if result.weekday() < 5:  # Mon-Fri
            added += 1
    return result


def _slot_datetime_iso(date_iso: str, start_time: str) -> datetime:
    """Combine date and HH:MM into timezone-aware UTC datetime (naive local interpreted as UTC for simplicity)."""
    try:
        d = date.fromisoformat(date_iso)
        parts = start_time.strip().split(":")
        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        return datetime(d.year, d.month, d.day, h, m, 0, tzinfo=timezone.utc)
    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail="Invalid slot") from e


@router.get("/booking/{token}", response_model=dict)
def get_booking_page_context(token: str, db: Session = Depends(get_db)) -> dict:
    client = db.query(ClientRecord).filter(ClientRecord.booking_access_token == token).first()
    if not client:
        raise HTTPException(status_code=404, detail="Invalid or expired booking link")

    if client.confirmed_session_at:
        return {
            "client_name": client.full_name,
            "pathway": client.pathway or "Assessment",
            "already_booked": True,
            "confirmed_session_at": client.confirmed_session_at.isoformat(),
            "slots": [],
        }

    if client.status != "Forms Returned, Ready to Schedule":
        raise HTTPException(
            status_code=400,
            detail="This link is not active for scheduling. Contact the clinic if you need help.",
        )

    if not client.assigned_clinician_user_id:
        raise HTTPException(
            status_code=400,
            detail="A clinician has not been assigned to your case yet. We will email you when you can book.",
        )

    clinician = db.query(UserRecord).filter(UserRecord.id == client.assigned_clinician_user_id).first()
    today = date.today().isoformat()
    slots = (
        db.query(ClinicianAvailabilitySlotRecord)
        .filter(
            ClinicianAvailabilitySlotRecord.user_id == client.assigned_clinician_user_id,
            ClinicianAvailabilitySlotRecord.rota_status == "confirmed",
            ClinicianAvailabilitySlotRecord.date_iso >= today,
        )
        .order_by(
            ClinicianAvailabilitySlotRecord.date_iso,
            ClinicianAvailabilitySlotRecord.start_time,
        )
        .all()
    )

    return {
        "client_name": client.full_name,
        "pathway": client.pathway or "Assessment",
        "already_booked": False,
        "clinician_name": clinician.full_name if clinician else "Your clinician",
        "slots": [
            {
                "id": s.id,
                "date_iso": s.date_iso,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "label": f"{s.date_iso} · {s.start_time}–{s.end_time}",
            }
            for s in slots
        ],
    }


class SelectSlotBody(BaseModel):
    slot_id: str


@router.post("/booking/{token}/select", response_model=dict)
def select_booking_slot(token: str, body: SelectSlotBody, db: Session = Depends(get_db)) -> dict:
    client = db.query(ClientRecord).filter(ClientRecord.booking_access_token == token).first()
    if not client:
        raise HTTPException(status_code=404, detail="Invalid or expired booking link")

    if client.confirmed_session_at:
        raise HTTPException(status_code=400, detail="You have already booked an assessment time.")

    if not client.assigned_clinician_user_id:
        raise HTTPException(status_code=400, detail="No clinician assigned")

    slot = (
        db.query(ClinicianAvailabilitySlotRecord)
        .filter(
            ClinicianAvailabilitySlotRecord.id == body.slot_id,
            ClinicianAvailabilitySlotRecord.user_id == client.assigned_clinician_user_id,
            ClinicianAvailabilitySlotRecord.rota_status == "confirmed",
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=404, detail="That time is no longer available")

    clinician = db.query(UserRecord).filter(UserRecord.id == client.assigned_clinician_user_id).first()
    if not clinician:
        raise HTTPException(status_code=400, detail="Clinician record missing")

    session_at = _slot_datetime_iso(slot.date_iso, slot.start_time)
    client.confirmed_session_at = session_at
    client.status = "Assessment Booked"
    client.stage = "Assessment"
    # Calculate report due = 5 working days after the assessment
    client.report_due_at = _add_working_days(session_at, 5)
    # Block the slot so it cannot be double-booked
    slot.rota_status = "booked"
    slot.booked_client_id = client.id
    db.commit()
    db.refresh(client)

    assessment_ref = client.assessment_id or client.id
    video_url = assessment_meeting_url(assessment_ref)
    slot_label = f"{slot.date_iso} {slot.start_time}–{slot.end_time} (UTC)"

    ok_c = email_svc.send_booking_confirmation_client(
        to_email=client.email,
        client_id=client.id,
        client_name=client.full_name,
        pathway=client.pathway or "Assessment",
        slot_time=slot_label,
        video_meeting_url=video_url,
        clinician_name=clinician.full_name,
    )
    ok_cl = email_svc.send_booking_confirmation_clinician(
        to_email=clinician.email,
        client_id=client.id,
        clinician_name=clinician.full_name,
        client_name=client.full_name,
        pathway=client.pathway or "Assessment",
        slot_time=slot_label,
        video_meeting_url=video_url,
    )

    return {
        "ok": True,
        "confirmed_session_at": session_at.isoformat(),
        "video_meeting_url": video_url,
        "emails": {"client_sent": ok_c, "clinician_sent": ok_cl},
    }
