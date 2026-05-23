from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String

from app.db.base import Base


class ClientRecord(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True)            # CLI-XXXXXXXX
    clinic_id = Column(String, nullable=True, index=True)  # organization id — tenant isolation
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    pathway = Column(String, nullable=True)           # Adult ADHD, Adult Autism, etc.
    age_group = Column(String, nullable=True)         # Adult / Adolescent / Child
    child_name = Column(String, nullable=True)         # Child's full name (child bookings only)
    child_dob = Column(String, nullable=True)          # ISO date YYYY-MM-DD (child bookings only)
    status = Column(String, default="New")            # New → Intake → Booked → Assessment → Report → Complete
    stage = Column(String, default="Intake")
    source = Column(String, default="stripe")         # stripe | manual | woocommerce
    stripe_session_id = Column(String, nullable=True, unique=True)
    payment_amount = Column(String, nullable=True)
    payment_currency = Column(String, nullable=True)
    assessment_id = Column(String, nullable=True)     # ASS-XXXXXXXX
    paid_service_name = Column(String, nullable=True)  # From checkout line items / metadata
    # Clinician caseload: who is responsible for the assessment (UUID from users.id)
    assigned_clinician_user_id = Column(String, nullable=True, index=True)
    # Session and reporting SLAs (ISO times in DB, surfaced as date-range filters in UI)
    confirmed_session_at = Column(DateTime, nullable=True)
    report_due_at = Column(DateTime, nullable=True)
    # Opaque token for client-facing slot booking (/book/{token}); set when forms complete.
    booking_access_token = Column(String, nullable=True, unique=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ClientOut(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str | None = None
    pathway: str | None = None
    age_group: str | None = None
    child_name: str | None = None
    child_dob: str | None = None
    assigned_clinician_name: str | None = None
    status: str
    stage: str
    source: str
    assessment_id: str | None = None
    payment_amount: str | None = None
    payment_currency: str | None = None
    paid_service_name: str | None = None
    date_of_birth: str | None = None
    address: str | None = None
    gp_name: str | None = None
    gp_practice: str | None = None
    gp_email: str | None = None
    teacher_name: str | None = None
    teacher_email: str | None = None
    school_name: str | None = None
    parent_guardian_name: str | None = None
    parent_guardian_phone: str | None = None
    occupation: str | None = None
    medical_concerns: str | None = None
    ethnicity: str | None = None
    religion_group: str | None = None
    preferred_language: str | None = None
    created_at: datetime | None = None
    assigned_clinician_user_id: str | None = None
    confirmed_session_at: datetime | None = None
    report_due_at: datetime | None = None

    class Config:
        from_attributes = True


class ClientList(BaseModel):
    items: list[ClientOut]
    total: int


class ClientClinicianOut(BaseModel):
    """Client record for clinician/senior view - no billing, invoice, or email-log data."""

    id: str
    full_name: str
    email: str
    phone: str | None = None
    pathway: str | None = None
    age_group: str | None = None
    status: str
    stage: str
    assessment_id: str | None = None
    date_of_birth: str | None = None
    address: str | None = None
    gp_name: str | None = None
    gp_practice: str | None = None
    gp_email: str | None = None
    teacher_name: str | None = None
    teacher_email: str | None = None
    school_name: str | None = None
    parent_guardian_name: str | None = None
    parent_guardian_phone: str | None = None
    occupation: str | None = None
    medical_concerns: str | None = None
    created_at: datetime | None = None
    confirmed_session_at: datetime | None = None
    report_due_at: datetime | None = None

    class Config:
        from_attributes = True


class ClientAssignBody(BaseModel):
    clinician_user_id: str | None = None
