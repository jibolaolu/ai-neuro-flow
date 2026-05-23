"""
Subscriber API key management.

Organisations that subscribe to the Neuro Flow API receive a key that
grants them programmatic access to submit referrals, check assessment
status, and receive webhook events. Keys are scoped by tier:
  - basic  : submit referrals, check own records
  - pro    : full read/write + webhook registration
  - partner: all pro rights + white-label config
"""

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class APIKey(BaseModel):
    id: str
    key: str
    label: str
    tier: str
    created_at: str
    active: bool


class CreateKeyRequest(BaseModel):
    label: str
    tier: str = "basic"  # basic | pro | partner


# In-memory store - replace with DB table in production
_key_store: dict[str, APIKey] = {}


@router.post("/", response_model=APIKey, status_code=status.HTTP_201_CREATED)
def create_api_key(payload: CreateKeyRequest) -> APIKey:
    if payload.tier not in {"basic", "pro", "partner"}:
        raise HTTPException(status_code=400, detail="tier must be basic, pro, or partner")

    key_id = str(uuid.uuid4())
    raw_key = f"na_{payload.tier}_{secrets.token_urlsafe(32)}"
    record = APIKey(
        id=key_id,
        key=raw_key,
        label=payload.label,
        tier=payload.tier,
        created_at=datetime.now(timezone.utc).isoformat(),
        active=True,
    )
    _key_store[key_id] = record
    return record


@router.get("/", response_model=list[APIKey])
def list_api_keys() -> list[APIKey]:
    return list(_key_store.values())


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(key_id: str) -> None:
    record = _key_store.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail="API key not found")
    _key_store[key_id] = record.model_copy(update={"active": False})


@router.get("/tiers")
def list_tiers() -> dict:
    return {
        "tiers": [
            {
                "id": "basic",
                "label": "Basic",
                "price_monthly_gbp": 49,
                "features": ["Submit referrals", "Check own assessment status", "100 API calls/day"],
            },
            {
                "id": "pro",
                "label": "Pro",
                "price_monthly_gbp": 149,
                "features": ["Full referral + status API", "Webhook registration", "Bulk uploads", "1,000 API calls/day"],
            },
            {
                "id": "partner",
                "label": "Partner",
                "price_monthly_gbp": 399,
                "features": ["All Pro features", "White-label config", "Priority support", "Unlimited API calls"],
            },
        ]
    }
