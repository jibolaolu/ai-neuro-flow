"""DB-backed API key model for clinic integrations."""

import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.db.base import Base

# Key format:  nf_live_<32 random hex chars>
_PREFIX = "nf_live_"


def generate_api_key() -> tuple[str, str, str]:
    """
    Return (raw_key, key_hash, key_prefix).
    raw_key  — shown to the user ONCE at creation time, then discarded.
    key_hash — stored in the DB (SHA-256 of raw_key).
    key_prefix — first 16 chars of raw_key for safe display (e.g. "nf_live_a1b2c3d4").
    """
    raw = _PREFIX + secrets.token_hex(16)  # 40-char key total
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    key_prefix = raw[:16]
    return raw, key_hash, key_prefix


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


class ApiKeyRecord(Base):
    __tablename__ = "api_keys"

    id = Column(
        String, primary_key=True, default=lambda: f"KEY-{uuid.uuid4().hex[:10].upper()}"
    )
    clinic_id = Column(String, nullable=False, index=True)

    label = Column(String, nullable=False)
    # Tier controls what the key can do:
    #   basic   — submit clients only
    #   pro     — full read/write on clients + forms
    #   partner — all pro + webhook registration
    tier = Column(String, nullable=False, default="basic")

    key_hash = Column(String, nullable=False, unique=True, index=True)
    key_prefix = Column(
        String, nullable=False
    )  # safe to display, e.g. "nf_live_a1b2c3d4"

    active = Column(Boolean, default=True, nullable=False)

    # Usage tracking
    requests_total = Column(Integer, default=0, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    created_by = Column(String, nullable=True)  # user_id who created the key
