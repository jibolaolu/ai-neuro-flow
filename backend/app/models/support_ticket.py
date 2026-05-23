"""Support ticket model — raised by clinic users, resolved by platform team."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base

# ── Status constants ──────────────────────────────────────────────────────────
TICKET_STATUS_OPEN          = "open"
TICKET_STATUS_IN_PROGRESS   = "in_progress"
TICKET_STATUS_AWAITING_INFO = "awaiting_info"
TICKET_STATUS_RESOLVED      = "resolved"
TICKET_STATUS_CLOSED        = "closed"

# ── Priority constants ────────────────────────────────────────────────────────
TICKET_PRIORITY_LOW      = "low"
TICKET_PRIORITY_MEDIUM   = "medium"
TICKET_PRIORITY_HIGH     = "high"
TICKET_PRIORITY_CRITICAL = "critical"

# ── Category constants ────────────────────────────────────────────────────────
TICKET_CATEGORY_ACCESS       = "access"
TICKET_CATEGORY_BILLING      = "billing"
TICKET_CATEGORY_BUG          = "bug"
TICKET_CATEGORY_DATA         = "data"
TICKET_CATEGORY_FEATURE      = "feature_request"
TICKET_CATEGORY_INTEGRATION  = "integration"
TICKET_CATEGORY_OTHER        = "other"


class SupportTicketRecord(Base):
    __tablename__ = "support_tickets"

    id                  = Column(String, primary_key=True)
    # Raised by
    raised_by_user_id   = Column(String, nullable=False, index=True)
    raised_by_name      = Column(String, nullable=False, default="")
    raised_by_email     = Column(String, nullable=False, default="")
    # Clinic scope
    clinic_id           = Column(String, nullable=True, index=True)
    clinic_name         = Column(String, nullable=True)
    # Ticket content
    title               = Column(String, nullable=False)
    description         = Column(Text, nullable=False)
    category            = Column(String, nullable=False, default=TICKET_CATEGORY_OTHER)
    priority            = Column(String, nullable=False, default=TICKET_PRIORITY_MEDIUM)
    # Lifecycle
    status              = Column(String, nullable=False, default=TICKET_STATUS_OPEN)
    assigned_to_user_id = Column(String, nullable=True)
    assigned_to_name    = Column(String, nullable=True)
    platform_response   = Column(Text, nullable=True)
    # Timestamps
    created_at          = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at          = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                                 onupdate=lambda: datetime.now(timezone.utc))
    resolved_at         = Column(DateTime, nullable=True)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SupportTicketOut(BaseModel):
    id:                  str
    raised_by_user_id:   str
    raised_by_name:      str
    raised_by_email:     str
    clinic_id:           str | None
    clinic_name:         str | None
    title:               str
    description:         str
    category:            str
    priority:            str
    status:              str
    assigned_to_user_id: str | None
    assigned_to_name:    str | None
    platform_response:   str | None
    created_at:          datetime | None
    updated_at:          datetime | None
    resolved_at:         datetime | None

    class Config:
        from_attributes = True


class SupportTicketCreate(BaseModel):
    title:       str  = Field(..., min_length=3, max_length=200)
    description: str  = Field(..., min_length=10, max_length=10000)
    category:    str  = Field(default=TICKET_CATEGORY_OTHER)
    priority:    str  = Field(default=TICKET_PRIORITY_MEDIUM)


class SupportTicketUpdate(BaseModel):
    """Platform-admin-only patch fields."""
    status:              str | None = None
    assigned_to_user_id: str | None = None
    assigned_to_name:    str | None = None
    platform_response:   str | None = None
    priority:            str | None = None


class SupportTicketList(BaseModel):
    items: list[SupportTicketOut]
    total: int
