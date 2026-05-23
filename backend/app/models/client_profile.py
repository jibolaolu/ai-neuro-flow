from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class ClientProfileRecord(Base):
    """
    Profile details extracted from submitted intake forms.
    Kept separate from clients table to avoid disruptive schema changes.
    """

    __tablename__ = "client_profiles"

    client_id = Column(String, primary_key=True, index=True)
    date_of_birth = Column(String, nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    gp_name = Column(String, nullable=True)
    gp_practice = Column(String, nullable=True)
    gp_email = Column(String, nullable=True)
    teacher_name = Column(String, nullable=True)
    teacher_email = Column(String, nullable=True)
    school_name = Column(String, nullable=True)
    parent_guardian_name = Column(String, nullable=True)
    parent_guardian_phone = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    medical_concerns = Column(Text, nullable=True)
    ethnicity = Column(String, nullable=True)
    religion_group = Column(String, nullable=True)
    preferred_language = Column(String, nullable=True)
    # Instrument scores - JSON, populated when adult_self form is submitted
    scores = Column(Text, nullable=True)
    # AI pre-assessment overview - JSON, admin/senior-clinician only
    ai_clinical_report = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
