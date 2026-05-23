from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String

from app.db.base import Base


class ClinicianAvailabilitySlotRecord(Base):
    __tablename__ = "clinician_availability_slots"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    date_iso = Column(String, nullable=False)  # YYYY-MM-DD
    start_time = Column(String, nullable=False)  # HH:MM
    end_time = Column(String, nullable=False)  # HH:MM
    # ISO week: YYYY-Www - used for "weekly rota confirmed" flows
    week_id = Column(String, nullable=True, index=True)
    rota_status = Column(String, nullable=True)  # draft | confirmed | booked
    booked_client_id = Column(String, nullable=True, index=True)  # set when a client books this slot
    # Clinical-admin review
    admin_status = Column(String, nullable=True)  # pending | accepted | flagged | rejected
    admin_comment = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)  # reviewer full_name
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AvailabilitySlotIn(BaseModel):
    date_iso: str
    start_time: str
    end_time: str


class AvailabilitySlotOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    date_iso: str
    start_time: str
    end_time: str
    week_id: str | None
    rota_status: str | None
    admin_status: str | None = None
    admin_comment: str | None = None
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    booked_client_id: str | None = None
    booked_client_name: str | None = None
    booked_client_pathway: str | None = None

    class Config:
        from_attributes = True
