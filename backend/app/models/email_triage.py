"""Email triage log model."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.db.base import Base


class EmailTriageLog(Base):
    __tablename__ = "email_triage_logs"

    id = Column(String, primary_key=True)
    message_id = Column(String, unique=True, index=True, nullable=False)
    gmail_uid = Column(String, nullable=True)
    from_email = Column(String, nullable=False)
    from_name = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    received_at = Column(DateTime, nullable=True)
    body_snippet = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    urgency = Column(Integer, nullable=True)
    requires_clinician = Column(Boolean, default=False)
    ai_summary = Column(Text, nullable=True)
    ai_suggested_reply = Column(Text, nullable=True)
    status = Column(String, default="pending")
    auto_replied = Column(Boolean, default=False)
    reply_sent_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
    dismissed_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
