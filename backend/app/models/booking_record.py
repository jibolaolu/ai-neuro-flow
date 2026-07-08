"""SQLAlchemy model for persisted booking records."""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class BookingDBRecord(Base):
    __tablename__ = "booking_records"

    id = Column(String, primary_key=True, default=lambda: f"booking-{uuid.uuid4().hex[:8]}")
    case_id = Column(String, nullable=False)
    client_id = Column(String, nullable=False, index=True)
    client_name = Column(String, nullable=False)
    client_email = Column(String, nullable=False)
    clinician_id = Column(String, nullable=True)
    clinician_name = Column(String, nullable=True)
    pathway = Column(String, nullable=False)
    booking_status = Column(String, nullable=False, default="scheduled")
    payment_status = Column(String, nullable=False, default="paid")
    room_status = Column(String, nullable=False, default="provisioned")
    confirmation_status = Column(String, nullable=False, default="pending")
    sla_status = Column(String, nullable=False, default="on_track")
    slot_time = Column(String, nullable=True)
    source = Column(String, nullable=True)
    # JSON-serialised list of BookingWorkflowStep dicts
    workflow_steps_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    @property
    def workflow_steps(self) -> list[dict]:
        try:
            return json.loads(self.workflow_steps_json)
        except Exception:
            return []

    @workflow_steps.setter
    def workflow_steps(self, value: list[dict]) -> None:
        self.workflow_steps_json = json.dumps(value)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "case_id": self.case_id,
            "client_id": self.client_id,
            "client_name": self.client_name,
            "client_email": self.client_email,
            "clinician_id": self.clinician_id,
            "clinician_name": self.clinician_name,
            "pathway": self.pathway,
            "booking_status": self.booking_status,
            "payment_status": self.payment_status,
            "room_status": self.room_status,
            "confirmation_status": self.confirmation_status,
            "sla_status": self.sla_status,
            "slot_time": self.slot_time,
            "source": self.source,
            "workflow_steps": self.workflow_steps,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
