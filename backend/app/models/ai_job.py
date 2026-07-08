"""Async AI job tracking — SQLite-backed queue processed by APScheduler."""

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base

# ── Status constants ──────────────────────────────────────────────────────────
JOB_STATUS_QUEUED    = "queued"
JOB_STATUS_RUNNING   = "running"
JOB_STATUS_DONE      = "done"
JOB_STATUS_FAILED    = "failed"

# ── Worker type constants ─────────────────────────────────────────────────────
WORKER_FORM_ANALYSER  = "form_analyser"
WORKER_NOTE_PROCESSOR = "note_processor"
WORKER_REPORT_DRAFT   = "report_draft"
WORKER_DOC_EXTRACT    = "doc_extract"
WORKER_RISK_STRAT     = "risk_stratification"


class AIJobRecord(Base):
    __tablename__ = "ai_jobs"

    id           = Column(String, primary_key=True)
    worker_type  = Column(String, nullable=False, index=True)
    status       = Column(String, nullable=False, default=JOB_STATUS_QUEUED, index=True)
    clinic_id    = Column(String, nullable=True, index=True)
    created_by   = Column(String, nullable=True)   # user_id
    payload      = Column(Text, nullable=True)      # JSON input
    result       = Column(Text, nullable=True)      # JSON output
    error        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    started_at   = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AIJobOut(BaseModel):
    id:           str
    worker_type:  str
    status:       str
    clinic_id:    str | None
    created_by:   str | None
    result:       str | None
    error:        str | None
    created_at:   datetime | None
    started_at:   datetime | None
    completed_at: datetime | None

    class Config:
        from_attributes = True


class AIJobCreate(BaseModel):
    worker_type: str
    payload:     dict = {}


class AIJobList(BaseModel):
    items: list[AIJobOut]
    total: int
