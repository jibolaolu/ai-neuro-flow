import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from pydantic import BaseModel as PydanticBaseModel

from app.models.clinician_availability import (
    AvailabilitySlotIn,
    AvailabilitySlotOut,
    ClinicianAvailabilitySlotRecord,
)
from app.models.client import ClientRecord
from app.models.user import UserRecord


class SlotAdminActionIn(PydanticBaseModel):
    action: str  # accept | flag | reject | reset
    comment: str | None = None


def _slot_dict(
    s: ClinicianAvailabilitySlotRecord,
    user: UserRecord | None,
    booked_client: ClientRecord | None = None,
) -> dict:
    """Serialise a slot record to a dict (includes admin review fields + booking info)."""
    # For child clients, show child's name; otherwise show the booking parent/adult name
    booked_client_display: str | None = None
    if booked_client:
        booked_client_display = booked_client.child_name or booked_client.full_name

    return {
        "id": s.id,
        "user_id": s.user_id,
        "full_name": user.full_name if user else "Unknown",
        "email": user.email if user else None,
        "date_iso": s.date_iso,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "week_id": s.week_id,
        "rota_status": s.rota_status,
        "booked_client_id": s.booked_client_id,
        "booked_client_name": booked_client_display,
        "booked_client_pathway": booked_client.pathway if booked_client else None,
        "admin_status": s.admin_status,
        "admin_comment": s.admin_comment,
        "reviewed_by": s.reviewed_by,
        "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
    }

router = APIRouter()


def _pad_time(t: str) -> str:
    t = t.strip()
    m = re.match(r"^(\d{1,2}):(\d{2})$", t)
    if not m:
        return t
    h, minute = int(m.group(1)), m.group(2)
    if h > 23:
        raise HTTPException(status_code=400, detail="Invalid start or end time")
    return f"{h:02d}:{minute}"


def _to_minutes(t: str) -> int:
    p = _pad_time(t)
    h, m = p.split(":")
    return int(h) * 60 + int(m)


def _week_id(d_iso: str) -> str:
    y, mth, d = d_iso.split("-")
    d0 = date(int(y), int(mth), int(d))
    yw, w, _ = d0.isocalendar()
    return f"{yw:04d}-W{w:02d}"


@router.post("/slots", response_model=AvailabilitySlotOut)
def create_slot(
    body: AvailabilitySlotIn,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> AvailabilitySlotOut:
    try:
        date.fromisoformat(body.date_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="date_iso must be YYYY-MM-DD") from None
    start = _to_minutes(body.start_time)
    end = _to_minutes(body.end_time)
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    if end - start > 14 * 60:
        raise HTTPException(status_code=400, detail="Slot is too long (max 14 hours)")

    slot_id = f"AVL-{uuid.uuid4().hex[:8].upper()}"
    wk = _week_id(body.date_iso)
    rec = ClinicianAvailabilitySlotRecord(
        id=slot_id,
        user_id=user.id,
        date_iso=body.date_iso,
        start_time=_pad_time(body.start_time),
        end_time=_pad_time(body.end_time),
        week_id=wk,
        rota_status="draft",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return AvailabilitySlotOut(**_slot_dict(rec, user))


@router.get("/mine", response_model=dict)
def my_slots(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> dict:
    items = (
        db.query(ClinicianAvailabilitySlotRecord)
        .filter(ClinicianAvailabilitySlotRecord.user_id == user.id)
        .order_by(ClinicianAvailabilitySlotRecord.date_iso, ClinicianAvailabilitySlotRecord.start_time)
        .all()
    )
    booked_ids = {s.booked_client_id for s in items if s.booked_client_id}
    clients_map: dict[str, ClientRecord] = {}
    if booked_ids:
        clients_map = {c.id: c for c in db.query(ClientRecord).filter(ClientRecord.id.in_(booked_ids)).all()}
    return {"items": [_slot_dict(s, user, clients_map.get(s.booked_client_id or "")) for s in items]}


@router.get("/clinician/{user_id}/slots", response_model=dict)
def list_slots_for_user_as_admin(
    user_id: str,
    db: Session = Depends(get_db),
    admin: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Admin view of one clinician's availability rows (for team profile / capacity)."""
    target = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    if not target or target.role not in ("clinician", "senior-clinician"):
        raise HTTPException(status_code=404, detail="Clinician not found")
    slots = (
        db.query(ClinicianAvailabilitySlotRecord)
        .filter(ClinicianAvailabilitySlotRecord.user_id == user_id)
        .order_by(ClinicianAvailabilitySlotRecord.date_iso, ClinicianAvailabilitySlotRecord.start_time)
        .all()
    )
    return {"items": [_slot_dict(s, target) for s in slots]}


@router.get("/team", response_model=dict)
def team_availability(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    slots = (
        db.query(ClinicianAvailabilitySlotRecord)
        .order_by(ClinicianAvailabilitySlotRecord.date_iso, ClinicianAvailabilitySlotRecord.start_time)
        .all()
    )
    users = {u.id: u for u in db.query(UserRecord).all()}
    return {"items": [_slot_dict(s, users.get(s.user_id)) for s in slots]}


@router.post("/rota/confirm/{week_id}", response_model=dict)
def confirm_rota(
    week_id: str,
    db: Session = Depends(get_db),
    admin: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Mark all draft slots in a rota week as confirmed; emails each affected clinician (push TBD)."""
    from app.services import email as email_module

    q = db.query(ClinicianAvailabilitySlotRecord).filter(
        ClinicianAvailabilitySlotRecord.week_id == week_id,
        ClinicianAvailabilitySlotRecord.rota_status == "draft",
    )
    count = 0
    for s in q.all():
        s.rota_status = "confirmed"
        count += 1
    db.commit()
    email_stats: dict = {"emails_sent": 0, "users_notified": 0, "push": "deferred"}
    if count:
        email_stats = email_module.notify_clinicians_rota_week_confirmed(db, week_id, admin.full_name)
    return {
        "week_id": week_id,
        "updated_slots": count,
        "by": admin.full_name,
        "at": datetime.now(timezone.utc).isoformat(),
        "notifications": {
            "email": {
                "sent": email_stats.get("emails_sent", 0),
                "clinicians": email_stats.get("users_notified", 0),
            },
            "push": email_stats.get("push", "deferred"),
        },
    }


@router.patch("/slots/{slot_id}", response_model=dict)
def admin_action_on_slot(
    slot_id: str,
    body: SlotAdminActionIn,
    db: Session = Depends(get_db),
    admin: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """
    Clinic-admin actions on a single availability slot.
    action must be one of: accept | flag | reject | reset
    flag and reject support an optional free-text comment.
    Accepting a slot also marks it confirmed (rota_status).
    """
    VALID_ACTIONS = {"accept", "flag", "reject", "reset"}
    if body.action not in VALID_ACTIONS:
        raise HTTPException(status_code=400, detail=f"action must be one of {', '.join(sorted(VALID_ACTIONS))}")

    s = db.query(ClinicianAvailabilitySlotRecord).filter(ClinicianAvailabilitySlotRecord.id == slot_id).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")

    if body.action == "accept":
        s.admin_status = "accepted"
        s.rota_status = "confirmed"  # accepting auto-confirms the rota slot
    elif body.action == "flag":
        s.admin_status = "flagged"
    elif body.action == "reject":
        s.admin_status = "rejected"
    elif body.action == "reset":
        s.admin_status = "pending"
        s.admin_comment = None
        s.reviewed_by = None
        s.reviewed_at = None
        db.commit()
        user_rec = db.query(UserRecord).filter(UserRecord.id == s.user_id).first()
        return _slot_dict(s, user_rec)

    if body.action != "reset":
        s.admin_comment = body.comment
        s.reviewed_by = admin.full_name
        s.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    user_rec = db.query(UserRecord).filter(UserRecord.id == s.user_id).first()
    return _slot_dict(s, user_rec)


@router.delete("/slots/{slot_id}", response_model=dict)
def delete_slot(
    slot_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> dict:
    s = db.query(ClinicianAvailabilitySlotRecord).filter(ClinicianAvailabilitySlotRecord.id == slot_id).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")

    if user.role in ("clinical-admin", "super-platform-admin"):
        db.delete(s)
        db.commit()
        return {"deleted": slot_id}

    if s.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")
    if (s.rota_status or "draft") != "draft":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirmed rota availability cannot be removed by clinicians. Contact Clinical Admin to change it.",
        )
    db.delete(s)
    db.commit()
    return {"deleted": slot_id}
