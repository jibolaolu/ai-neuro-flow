"""
API key management for clinic integrations.

Keys use the format  nf_live_<32hex>  and are stored as SHA-256 hashes.
The raw key is returned ONCE at creation time and never retrievable again.

Tiers:
  basic   — submit clients via POST /intake/client only
  pro     — full read/write on clients + forms + webhook registration
  partner — all pro + white-label config
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.api_key import ApiKeyRecord, generate_api_key
from app.models.user import UserRecord
from app.services.tenant import effective_clinic_id

router = APIRouter()


# ── Response/request schemas ──────────────────────────────────────────────────


class ApiKeyOut(BaseModel):
    id: str
    label: str
    tier: str
    key_prefix: str  # "nf_live_a1b2c3d4" — safe to display
    active: bool
    requests_total: int
    last_used_at: Optional[datetime]
    created_at: datetime
    created_by: Optional[str]


class ApiKeyCreated(ApiKeyOut):
    raw_key: str  # returned ONCE — copy immediately


class CreateKeyRequest(BaseModel):
    label: str
    tier: str = "basic"  # basic | pro | partner


class PatchKeyRequest(BaseModel):
    label: Optional[str] = None
    active: Optional[bool] = None


# ── Tier catalogue (static — no DB needed) ────────────────────────────────────


@router.get("/tiers")
def list_tiers() -> dict:
    return {
        "tiers": [
            {
                "id": "basic",
                "label": "Basic",
                "price_monthly_gbp": 49,
                "features": [
                    "Submit new clients (POST /intake/client)",
                    "100 API calls / day",
                ],
            },
            {
                "id": "pro",
                "label": "Pro",
                "price_monthly_gbp": 149,
                "features": [
                    "Full client read/write + form tracking",
                    "Webhook registration and management",
                    "Bulk uploads",
                    "1 000 API calls / day",
                ],
            },
            {
                "id": "partner",
                "label": "Partner",
                "price_monthly_gbp": 399,
                "features": [
                    "All Pro features",
                    "White-label configuration",
                    "Priority support",
                    "Unlimited API calls",
                ],
            },
        ]
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.get("/", response_model=list[ApiKeyOut])
def list_api_keys(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> list[ApiKeyOut]:
    clinic_id = effective_clinic_id(user)
    keys = db.query(ApiKeyRecord).filter(ApiKeyRecord.clinic_id == clinic_id).order_by(ApiKeyRecord.created_at.desc()).all()
    return [ApiKeyOut.model_validate(k.__dict__) for k in keys]


@router.post("/", response_model=ApiKeyCreated, status_code=201)
def create_api_key(
    body: CreateKeyRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> ApiKeyCreated:
    """
    Create a new API key.  The raw key is returned in this response ONLY —
    it cannot be recovered afterwards.
    """
    if body.tier not in {"basic", "pro", "partner"}:
        raise HTTPException(status_code=400, detail="tier must be basic, pro, or partner")

    clinic_id = effective_clinic_id(user)
    raw, key_hash, key_prefix = generate_api_key()

    record = ApiKeyRecord(
        clinic_id=clinic_id,
        label=body.label,
        tier=body.tier,
        key_hash=key_hash,
        key_prefix=key_prefix,
        active=True,
        requests_total=0,
        created_at=datetime.now(timezone.utc),
        created_by=user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    out = ApiKeyOut.model_validate(record.__dict__)
    return ApiKeyCreated(**out.model_dump(), raw_key=raw)


@router.patch("/{key_id}", response_model=ApiKeyOut)
def update_api_key(
    key_id: str,
    body: PatchKeyRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> ApiKeyOut:
    clinic_id = effective_clinic_id(user)
    record = db.query(ApiKeyRecord).filter(ApiKeyRecord.id == key_id, ApiKeyRecord.clinic_id == clinic_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="API key not found")
    if body.label is not None:
        record.label = body.label
    if body.active is not None:
        record.active = body.active
    db.commit()
    db.refresh(record)
    return ApiKeyOut.model_validate(record.__dict__)


@router.delete("/{key_id}", status_code=204, response_class=Response)
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
        )
    ),
) -> None:
    clinic_id = effective_clinic_id(user)
    record = db.query(ApiKeyRecord).filter(ApiKeyRecord.id == key_id, ApiKeyRecord.clinic_id == clinic_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(record)
    db.commit()
