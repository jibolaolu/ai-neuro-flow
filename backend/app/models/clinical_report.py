"""Clinical report model — stores the full assessment report lifecycle."""

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base

# Report status lifecycle: draft → pending → complete → issued
REPORT_STATUS_DRAFT = "draft"
REPORT_STATUS_PENDING = "pending"
REPORT_STATUS_COMPLETE = "complete"
REPORT_STATUS_ISSUED = "issued"


class ClinicalReportRecord(Base):
    __tablename__ = "clinical_reports"

    id = Column(String, primary_key=True)                       # RPT-XXXXXXXX
    clinic_id = Column(String, nullable=True, index=True)
    client_id = Column(String, nullable=False, index=True)
    clinician_id = Column(String, nullable=False, index=True)   # authored by (user_id)
    report_type = Column(String, nullable=False)                # e.g. "NHS Adult ADHD"
    status = Column(String, default=REPORT_STATUS_DRAFT)        # draft|pending|complete|issued
    sections_json = Column(Text, nullable=True)                 # JSON dict section_key -> text
    place_of_assessment = Column(String, nullable=True)
    date_of_assessment = Column(String, nullable=True)          # ISO date YYYY-MM-DD
    assessed_by = Column(String, nullable=True)                 # clinician full name + credentials
    # PDF artefact
    pdf_path = Column(String, nullable=True)                    # absolute path on server
    pdf_token = Column(String, nullable=True, unique=True, index=True)  # public read token
    pdf_token_expires_at = Column(DateTime, nullable=True)
    # Review workflow
    reviewed_by_id = Column(String, nullable=True)
    reviewed_by_name = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_comment = Column(String, nullable=True)
    # Key timestamps
    submitted_at = Column(DateTime, nullable=True)
    issued_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ReportSectionIn(BaseModel):
    key: str
    content: str


class ClinicalReportCreate(BaseModel):
    client_id: str
    report_type: str
    date_of_assessment: str | None = None
    place_of_assessment: str | None = None
    assessed_by: str | None = None


class ClinicalReportPatch(BaseModel):
    sections: dict[str, str] | None = None
    place_of_assessment: str | None = None
    date_of_assessment: str | None = None
    assessed_by: str | None = None
    report_type: str | None = None


class ClinicalReportOut(BaseModel):
    id: str
    client_id: str
    clinician_id: str
    report_type: str
    status: str
    sections: dict[str, str]
    place_of_assessment: str | None = None
    date_of_assessment: str | None = None
    assessed_by: str | None = None
    pdf_token: str | None = None
    pdf_token_expires_at: datetime | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    review_comment: str | None = None
    submitted_at: datetime | None = None
    issued_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
