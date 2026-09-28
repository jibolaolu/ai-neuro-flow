"""Waiting list management — clients grouped by intake stage."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.form_token import FormToken
from app.models.user import UserRecord
from app.services import email as email_svc

router = APIRouter()


@router.get("", response_model=dict)
def get_waitlist(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """
    Returns clients on the waiting list grouped by stage:
    - awaiting_forms: forms sent but not all returned
    - awaiting_clinician: forms done but no clinician assigned
    - awaiting_booking: clinician assigned but no session booked
    """
    clients = db.query(ClientRecord).filter(
        ClientRecord.status.notin_(["Complete", "Assessment Complete", "Report Issued"])
    ).order_by(ClientRecord.created_at).all()

    awaiting_forms = []
    awaiting_clinician = []
    awaiting_booking = []

    for c in clients:
        forms = db.query(FormToken).filter(FormToken.client_id == c.id).all()
        all_submitted = forms and all(f.status == "submitted" for f in forms)
        any_forms = len(forms) > 0

        if c.confirmed_session_at:
            continue

        if not any_forms or not all_submitted:
            days_waiting = None
            if c.created_at:
                from datetime import datetime, timezone
                created = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
                days_waiting = (datetime.now(timezone.utc) - created).days
            awaiting_forms.append({
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "pathway": c.pathway,
                "status": c.status,
                "forms_sent": any_forms,
                "forms_completed": sum(1 for f in forms if f.status == "submitted"),
                "forms_total": len(forms),
                "days_waiting": days_waiting,
                "booking_access_token": c.booking_access_token,
            })
        elif not c.assigned_clinician_user_id:
            awaiting_clinician.append({
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "pathway": c.pathway,
                "status": c.status,
                "booking_access_token": c.booking_access_token,
            })
        else:
            clinician = db.query(UserRecord).filter(UserRecord.id == c.assigned_clinician_user_id).first()
            awaiting_booking.append({
                "id": c.id,
                "full_name": c.full_name,
                "email": c.email,
                "pathway": c.pathway,
                "status": c.status,
                "clinician_name": clinician.full_name if clinician else None,
                "booking_access_token": c.booking_access_token,
            })

    return {
        "awaiting_forms": awaiting_forms,
        "awaiting_clinician": awaiting_clinician,
        "awaiting_booking": awaiting_booking,
        "total": len(awaiting_forms) + len(awaiting_clinician) + len(awaiting_booking),
    }


@router.post("/send-booking-invite/{client_id}", response_model=dict)
def send_booking_invite(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    client = db.query(ClientRecord).filter(ClientRecord.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client.booking_access_token:
        raise HTTPException(status_code=400, detail="Client has no booking token")
    try:
        email_svc.send_booking_invite(client)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send invite: {e}") from e
    return {"ok": True, "message": f"Booking invite sent to {client.email}"}
