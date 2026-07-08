"""Follow-up form schedule — dispatches forms at 3, 6, 12 months post-assessment."""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String

from app.db.base import Base

FOLLOWUP_STATUS_PENDING    = "pending"
FOLLOWUP_STATUS_DISPATCHED = "dispatched"
FOLLOWUP_STATUS_FAILED     = "failed"
FOLLOWUP_STATUS_SKIPPED    = "skipped"


class FollowUpScheduleRecord(Base):
    __tablename__ = "follow_up_schedules"

    id             = Column(String, primary_key=True)
    client_id      = Column(String, nullable=False, index=True)
    clinic_id      = Column(String, nullable=True, index=True)
    assessment_id  = Column(String, nullable=True)
    recipient_email = Column(String, nullable=False)
    client_name    = Column(String, nullable=True)
    months_offset  = Column(Integer, nullable=False)   # 3, 6, or 12
    due_at         = Column(DateTime, nullable=False)
    status         = Column(String, default=FOLLOWUP_STATUS_PENDING)
    form_token_id  = Column(String, nullable=True)     # FK to form_tokens.id once dispatched
    dispatched_at  = Column(DateTime, nullable=True)
    created_by     = Column(String, nullable=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class FollowUpScheduleCreate(BaseModel):
    months_offsets: list[int] = [3, 6, 12]  # which checkpoints to schedule


class FollowUpScheduleOut(BaseModel):
    id: str
    client_id: str
    clinic_id: str | None
    months_offset: int
    due_at: datetime
    status: str
    dispatched_at: datetime | None

    class Config:
        from_attributes = True


class FollowUpScheduleList(BaseModel):
    items: list[FollowUpScheduleOut]
    total: int
