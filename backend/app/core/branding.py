"""Central platform branding — override via environment / Settings.
For per-clinic (tenant) branding, use get_clinic_branding(db, clinic_id).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

PLATFORM_SLUG = "neuro_flow"
PLATFORM_DISPLAY_NAME = settings.platform_display_name
PLATFORM_TAGLINE = settings.platform_tagline
SUPPORT_EMAIL = settings.support_email
COOKIE_TOKEN = settings.auth_cookie_name
COOKIE_USER = settings.auth_user_cookie_name


@dataclass
class ClinicBranding:
    """Resolved branding for a specific clinic tenant.
    Falls back to platform defaults for any unset field."""

    clinic_id: str | None
    display_name: str
    support_email: str
    contact_phone: str | None
    address: str | None
    website: str | None
    logo_url: str | None
    registered_company_number: str | None
    cqc_registration_number: str | None
    ico_registration_number: str | None


def get_clinic_branding(db: "Session", clinic_id: str | None) -> ClinicBranding:
    """Return branding for the given clinic, falling back to platform defaults."""
    from app.models.organization import OrganizationRecord

    org = None
    if clinic_id:
        org = (
            db.query(OrganizationRecord)
            .filter(OrganizationRecord.id == clinic_id)
            .first()
        )

    return ClinicBranding(
        clinic_id=clinic_id,
        display_name=(org.display_name or org.name) if org else PLATFORM_DISPLAY_NAME,
        support_email=org.support_email
        if (org and org.support_email)
        else SUPPORT_EMAIL,
        contact_phone=org.contact_phone if org else None,
        address=org.address if org else None,
        website=org.website if org else None,
        logo_url=org.logo_url if org else None,
        registered_company_number=org.registered_company_number if org else None,
        cqc_registration_number=org.cqc_registration_number if org else None,
        ico_registration_number=org.ico_registration_number if org else None,
    )
