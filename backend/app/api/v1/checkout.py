"""
Pre-payment checkout endpoint.

WordPress calls POST /api/v1/checkout/pre-payment just before redirecting
the customer to the Stripe Payment Link.  We persist the full client record
(including child DOB) and return a short pending_id that is appended to the
Stripe URL as client_reference_id.

When Stripe fires checkout.session.completed the webhook reads
session.client_reference_id, fetches this record, and uses the stored
child_dob to determine the exact age group.
"""
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.pending_checkout import PendingCheckout

from fastapi import HTTPException

from app.core.config import settings

router = APIRouter()


def _require_legacy_checkout() -> None:
    if not settings.enable_legacy_woocommerce_webhook:
        raise HTTPException(
            status_code=404,
            detail="Legacy WordPress checkout is disabled on Neuro Flow",
        )


# ── Request / response schema ──────────────────────────────────────────────────

class PrePaymentRequest(BaseModel):
    # Parent / client details (from Step 2 "Your Details" form)
    first_name: str
    last_name:  str
    email:      str
    phone:      str = ""
    dob:        str = ""       # DD/MM/YYYY as entered on form
    address:    str = ""       # comma-joined address string

    # Which Stripe service was chosen
    service_key: str = ""

    # Child fields - only present when booking for a child
    for_child:        bool = False
    child_first_name: str  = ""
    child_last_name:  str  = ""
    child_dob:        str  = ""   # ISO YYYY-MM-DD  (converted by the JS before posting)


class PrePaymentResponse(BaseModel):
    pending_id: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _dmy_to_iso(dmy: str) -> str:
    """Convert DD/MM/YYYY → YYYY-MM-DD.  Returns empty string if format unrecognised."""
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", (dmy or "").strip())
    if not m:
        return dmy.strip()
    d, mo, y = m.groups()
    return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"


# ── Route ──────────────────────────────────────────────────────────────────────

@router.post("/pre-payment", response_model=PrePaymentResponse)
def pre_payment(body: PrePaymentRequest, db: Session = Depends(get_db)) -> PrePaymentResponse:
    """
    Store client details before Stripe redirect.
    Returns a pending_id to be passed as Stripe client_reference_id.
    """
    _require_legacy_checkout()
    pending_id = f"PC-{uuid.uuid4().hex[:8].upper()}"

    # Normalise child DOB to ISO so the webhook can parse it directly
    child_dob_iso = ""
    if body.for_child and body.child_dob:
        child_dob_iso = _dmy_to_iso(body.child_dob)

    record = PendingCheckout(
        id               = pending_id,
        first_name       = body.first_name.strip(),
        last_name        = body.last_name.strip(),
        email            = body.email.strip().lower(),
        phone            = body.phone.strip(),
        dob              = body.dob.strip(),
        address          = body.address.strip(),
        service_key      = body.service_key.strip(),
        for_child        = body.for_child,
        child_first_name = body.child_first_name.strip(),
        child_last_name  = body.child_last_name.strip(),
        child_dob        = child_dob_iso,
    )
    db.add(record)
    db.commit()

    return PrePaymentResponse(pending_id=pending_id)
