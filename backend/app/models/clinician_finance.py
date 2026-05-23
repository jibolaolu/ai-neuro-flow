"""Clinician self-billing: timesheet lines and generated invoice requests."""

from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text

from app.db.base import Base


class TimesheetLineRecord(Base):
    __tablename__ = "timesheet_lines"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    activity_date = Column(Date, nullable=False)
    hours = Column(Float, nullable=False)
    description = Column(String(500), nullable=False)
    client_ref = Column(String(200), nullable=True)
    status = Column(String(20), nullable=False, default="submitted")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class InvoiceRequestRecord(Base):
    __tablename__ = "invoice_requests"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="generated")
    total_hours = Column(Float, nullable=True)
    line_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    # pending | approved | rejected | needs_revision
    approval_status = Column(String(24), nullable=False, default="pending")
    reviewed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
