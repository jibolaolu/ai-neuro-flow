"""Right to Choose (NHS) referral records."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.base import Base

RTC_STATUS_PENDING   = "pending"
RTC_STATUS_ACCEPTED  = "accepted"
RTC_STATUS_REJECTED  = "rejected"
RTC_STATUS_CONVERTED = "converted"   # accepted → client record created

RTC_PRIORITY_ROUTINE = "routine"
RTC_PRIORITY_URGENT  = "urgent"

PATHWAYS = [
    "Adult ADHD",
    "Adult Autism",
    "Adult ADHD + Autism",
    "Child ADHD",
    "Child Autism",
    "Child ADHD + Autism",
    "Adolescent ADHD",
    "Adolescent Autism",
]


class RTCReferralRecord(Base):
    __tablename__ = "rtc_referrals"

    id                      = Column(String, primary_key=True,
                                     default=lambda: f"RTC-{uuid.uuid4().hex[:8].upper()}")
    clinic_id               = Column(String, nullable=False, index=True)

    # Patient
    patient_name            = Column(String, nullable=False)
    patient_dob             = Column(String, nullable=True)
    patient_nhs_number      = Column(String, nullable=True)
    patient_email           = Column(String, nullable=True)
    patient_phone           = Column(String, nullable=True)
    patient_address         = Column(Text, nullable=True)

    # Referrer / GP
    gp_name                 = Column(String, nullable=True)
    gp_practice             = Column(String, nullable=True)
    gp_email                = Column(String, nullable=True)
    icb_name                = Column(String, nullable=True)   # Integrated Care Board
    referrer_name           = Column(String, nullable=True)   # if not GP

    # Clinical
    pathway                 = Column(String, nullable=False)
    priority                = Column(String, nullable=False, default=RTC_PRIORITY_ROUTINE)
    presenting_concerns     = Column(Text, nullable=True)
    relevant_history        = Column(Text, nullable=True)
    previous_assessments    = Column(Text, nullable=True)

    # Status
    status                  = Column(String, nullable=False, default=RTC_STATUS_PENDING)
    rejection_reason        = Column(Text, nullable=True)
    acceptance_notes        = Column(Text, nullable=True)
    eligibility_confirmed   = Column(Boolean, nullable=False, default=False)
    acceptance_letter_sent  = Column(Boolean, nullable=False, default=False)
    converted_client_id     = Column(String, nullable=True)   # set when accepted+converted

    # Dates
    referred_date           = Column(DateTime, nullable=True)
    accepted_at             = Column(DateTime, nullable=True)
    rejected_at             = Column(DateTime, nullable=True)
    created_at              = Column(DateTime, nullable=False,
                                     default=lambda: datetime.now(timezone.utc))
    updated_at              = Column(DateTime, nullable=False,
                                     default=lambda: datetime.now(timezone.utc),
                                     onupdate=lambda: datetime.now(timezone.utc))
    created_by              = Column(String, nullable=True)
