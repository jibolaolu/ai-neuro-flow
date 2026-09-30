"""Email triage API — admin-only endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.email_triage import EmailTriageLog
from app.models.user import UserRecord

router = APIRouter()

ADMIN_ROLES = {"clinical-admin", "super-platform-admin"}


def _require_admin(user: UserRecord) -> UserRecord:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class EmailTriageOut(BaseModel):
    id: str
    from_email: str
    from_name: str | None
    subject: str | None
    received_at: datetime | None
    body_snippet: str | None
    category: str | None
    urgency: int | None
    requires_clinician: bool
    ai_summary: str | None
    ai_suggested_reply: str | None
    status: str
    auto_replied: bool
    reply_sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendReplyRequest(BaseModel):
    reply_text: str | None = None


@router.get("/", response_model=list[EmailTriageOut])
def list_triage(
    status: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    _require_admin(user)
    q = db.query(EmailTriageLog).order_by(EmailTriageLog.created_at.desc())
    if status:
        q = q.filter(EmailTriageLog.status == status)
    return q.limit(limit).all()


@router.post("/{entry_id}/dismiss", response_model=dict)
def dismiss_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    _require_admin(user)
    entry = db.query(EmailTriageLog).filter(EmailTriageLog.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.status = "dismissed"
    entry.dismissed_at = datetime.now(timezone.utc)
    entry.dismissed_by = user.id
    db.commit()
    return {"ok": True}


@router.get("/stats", response_model=dict)
def triage_stats(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    _require_admin(user)
    total = db.query(EmailTriageLog).count()
    pending = db.query(EmailTriageLog).filter(EmailTriageLog.status == "pending").count()
    urgent = db.query(EmailTriageLog).filter(EmailTriageLog.urgency >= 7, EmailTriageLog.status == "pending").count()
    return {"total": total, "pending": pending, "urgent": urgent}
