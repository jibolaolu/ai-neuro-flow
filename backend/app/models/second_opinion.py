"""Second-opinion requests — clinician peer review on a report."""
import secrets
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class SecondOpinionRequest(Base):
    __tablename__ = "second_opinion_requests"

    id = Column(String, primary_key=True, default=lambda: f"SOR-{secrets.token_hex(4).upper()}")
    report_id = Column(String, nullable=False, index=True)
    client_id = Column(String, nullable=True, index=True)
    requesting_clinician_id = Column(String, nullable=False)
    requesting_clinician_name = Column(String, nullable=True)
    second_clinician_id = Column(String, nullable=True)
    second_clinician_name = Column(String, nullable=True)
    status = Column(String, default="requested")
    request_note = Column(Text, nullable=True)
    second_opinion_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))


class SecondOpinionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_id: str
    client_id: str | None
    requesting_clinician_id: str
    requesting_clinician_name: str | None
    second_clinician_id: str | None
    second_clinician_name: str | None
    status: str
    request_note: str | None
    second_opinion_note: str | None
    created_at: datetime
    updated_at: datetime | None


class SecondOpinionCreate(BaseModel):
    second_clinician_id: str | None = None
    request_note: str | None = None


class SecondOpinionAssign(BaseModel):
    second_clinician_id: str


class SecondOpinionRespond(BaseModel):
    status: str
    second_opinion_note: str | None = None
