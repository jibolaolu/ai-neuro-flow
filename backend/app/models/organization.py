"""Multi-tenant organization (clinic) — subscription billed to the clinic, not patients."""

from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Boolean, Column, DateTime, String

from app.db.base import Base

# Subscription lifecycle
SUB_TRIALING = "trialing"
SUB_ACTIVE = "active"
SUB_PAST_DUE = "past_due"
SUB_CANCELED = "canceled"
SUB_INCOMPLETE = "incomplete"

PLAN_STARTER = "starter"
PLAN_PROFESSIONAL = "professional"
PLAN_ENTERPRISE = "enterprise"


class OrganizationRecord(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True)  # ORG-XXXXXXXX
    name = Column(String, nullable=False)  # internal identifier
    display_name = Column(String, nullable=True)  # shown on reports, forms, emails
    slug = Column(String, unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)

    # Clinic contact branding — shown on reports/emails/invoices to clients
    support_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    website = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)

    # UK regulatory identifiers
    registered_company_number = Column(String, nullable=True)
    cqc_registration_number = Column(String, nullable=True)
    ico_registration_number = Column(String, nullable=True)

    subscription_status = Column(String, default=SUB_TRIALING)
    subscription_plan = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)

    trial_ends_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class OrganizationSignup(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    admin_full_name: str = Field(..., min_length=2, max_length=200)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8, max_length=128)


class OrganizationOut(BaseModel):
    id: str
    name: str
    display_name: str | None = None
    slug: str
    is_active: bool
    subscription_status: str
    subscription_plan: str | None = None
    support_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    website: str | None = None
    logo_url: str | None = None
    registered_company_number: str | None = None
    cqc_registration_number: str | None = None
    ico_registration_number: str | None = None
    trial_ends_at: datetime | None = None

    class Config:
        from_attributes = True


class InviteClinicianBody(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=200)
    role: str = Field(..., pattern=r"^(clinician|senior-clinician)$")
    password: str = Field(..., min_length=8, max_length=128)
