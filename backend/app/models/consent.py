"""Client consent model — stores all consent items and channel preferences."""

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base

# Consent item keys
CONSENT_ITEMS = [
    "gdpr_data_processing",
    "consent_to_care",
    "share_with_gp",
    "contact_school",
    "keep_in_touch_email",
    "keep_in_touch_sms",
    "nhs_share",
    "nhs_consent_to_care",
]


class ClientConsentRecord(Base):
    __tablename__ = "client_consents"

    id = Column(String, primary_key=True)
    client_id = Column(String, nullable=False, unique=True, index=True)
    consents_json = Column(Text, nullable=True)   # JSON: { "gdpr_data_processing": true, ... }
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_by = Column(String, nullable=True)    # user_id who last set


class ConsentIn(BaseModel):
    consents: dict[str, bool]


class ConsentOut(BaseModel):
    client_id: str
    consents: dict[str, bool]
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
