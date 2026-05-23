"""Audit trail for outbound transactional emails (SendGrid + dev console attempts)."""

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.db.base import Base


class EmailSendLog(Base):
    __tablename__ = "email_send_logs"

    id = Column(String, primary_key=True)
    client_id = Column(String, nullable=True, index=True)
    template_key = Column(String, nullable=False, index=True)
    recipient_email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    from_email = Column(String, nullable=False)
    body_preview = Column(Text, nullable=False)
    html_snapshot = Column(Text, nullable=True)
    success = Column(Boolean, default=False)
    delivery_mode = Column(String, nullable=False)
    sendgrid_status_code = Column(Integer, nullable=True)
    sendgrid_response_excerpt = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class EmailSendLogOut(BaseModel):
    id: str
    client_id: str | None
    template_key: str
    recipient_email: str
    subject: str
    from_email: str
    body_preview: str
    html_snapshot: str | None
    success: bool
    delivery_mode: str
    sendgrid_status_code: int | None
    sendgrid_response_excerpt: str | None
    error_message: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True


class EmailSendLogList(BaseModel):
    items: list[EmailSendLogOut]
    total: int
