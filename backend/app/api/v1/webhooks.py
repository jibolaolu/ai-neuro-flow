"""
WordPress / WooCommerce payment webhook.

WordPress calls POST /api/v1/webhooks/payment when a WooCommerce order is
completed. Neuro Flow validates the shared secret, parses the order data,
creates a client record and triggers the intake workflow.

Setup steps for WordPress (SiteGround):
  1. Install WooCommerce Webhooks or use native WooCommerce → Settings →
     Advanced → Webhooks.
  2. Create a new webhook:
     - Topic:   Order completed  (woocommerce.order.completed)
     - Delivery URL: https://<your-neuroflow-domain>/api/v1/webhooks/payment
     - Secret:  value of WEBHOOK_SECRET in your backend .env
  3. Set Content-Type to application/json.
"""

import hashlib
import hmac
import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.dev_guard import require_non_production
from app.core.config import settings
from app.models.client import ClientRecord
from app.models.pending_checkout import PendingCheckout
from app.models.form_token import (
    FORM_ADULT_SELF,
    FORM_ADOLESCENT_SELF,
    FORM_BASIC_INTAKE,
    FORM_CHILD_PARENT,
)

router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    name: str
    quantity: int = 1
    total: str = "0.00"


class WooCommercePayload(BaseModel):
    """Subset of fields sent by WooCommerce order.completed webhook."""
    id: int
    status: str
    total: str
    currency: str = "GBP"
    date_created: str = ""
    billing: dict = {}
    line_items: list[LineItem] = []


class WebhookResult(BaseModel):
    received: bool
    client_id: str
    assessment_id: str
    pathway: str
    next_step: str


# ── Pathway detection ──────────────────────────────────────────────────────────
# Longer phrases must win over short ones (e.g. "adhd screening" before bare "adhd").
# Age group: explicit "child" in product text → Child; checkout metadata overrides below.

_PATHWAY_RULES: list[tuple[str, str]] = [
    ("child adhd autism", "Child ADHD + Autism"),
    ("adult adhd autism", "Adult ADHD + Autism"),
    ("child adhd screening", "ADHD Screening"),
    ("adult adhd screening", "ADHD Screening"),
    ("child autism screening", "Autism Screening"),
    ("child adhd", "Child ADHD"),
    ("child autism", "Child Autism"),
    ("adult autism", "Adult Autism"),
    ("adult adhd", "Adult ADHD"),
    ("adhd screening", "ADHD Screening"),
    ("adhd autism", "Adult ADHD + Autism"),
    ("autism", "Adult Autism"),
    ("adhd", "Adult ADHD"),
]
_PATHWAY_RULES.sort(key=lambda kv: len(kv[0]), reverse=True)

# Ignored when matching so "Adult ADHD assessment screening" still matches rule "adult adhd screening".
_PATHWAY_FILLER_TOKENS: frozenset[str] = frozenset(
    {
        "assessment",
        "assessments",
        "package",
        "pack",
        "service",
        "session",
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "for",
        "clinic",
        "with",
    }
)


def _tokenize_product_text(*parts: str) -> list[str]:
    """Lowercase word tokens, dropping punctuation and generic filler for pathway matching."""
    raw = " ".join(p for p in parts if p).lower()
    raw = re.sub(r"[^\w+]+", " ", raw, flags=re.UNICODE)
    return [t for t in raw.split() if t and t not in _PATHWAY_FILLER_TOKENS]


def _ordered_keyword_match(tokens: list[str], keyword_phrase: str) -> bool:
    """True if all words in keyword_phrase appear in order in tokens (allows gaps)."""
    needle = [w for w in keyword_phrase.split() if w]
    if not needle:
        return False
    i = 0
    for t in tokens:
        if t == needle[i]:
            i += 1
            if i == len(needle):
                return True
    return False


def _age_group_from_combined(combined: str) -> str:
    """Infer age group from product wording when no DOB metadata is present.
    Without a DOB we can only distinguish child-pathway products from adult ones.
    Adolescent is resolved properly once child_dob is available.
    """
    return "Child" if "child" in combined else "Adult"


def _age_from_dob(dob_str: str | None) -> int | None:
    """Return age in whole years from an ISO date string (YYYY-MM-DD). Returns None if unparseable."""
    if not dob_str:
        return None
    try:
        dob = date.fromisoformat(str(dob_str).strip()[:10])
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except (ValueError, TypeError):
        return None


def _age_group_from_age(age: int) -> str:
    """Map a calculated age to the three clinical age-group bands."""
    if age <= 10:
        return "Child"       # 5–10  → Child pack
    elif age <= 17:
        return "Adolescent"  # 11–17 → Adolescent pack
    else:
        return "Adult"       # 18+   → Adult pack


def _primary_form_for_age_group(age_group: str) -> str:
    """Return the pathway-specific form type for a given age group."""
    if age_group == "Child":
        return FORM_CHILD_PARENT
    if age_group == "Adolescent":
        return FORM_ADOLESCENT_SELF
    return FORM_ADULT_SELF


def detect_pathway(line_items: list[LineItem]) -> tuple[str, str]:
    """Returns (pathway_label, age_group). Falls back to first product title if no keyword matches."""
    if not line_items:
        return "Adult ADHD", "Adult"
    raw_combined = " ".join((item.name or "") for item in line_items)
    combined_lower = raw_combined.lower()
    first_title = (line_items[0].name or "").strip()
    tokens = _tokenize_product_text(*((item.name or "") for item in line_items))

    for keyword, label in _PATHWAY_RULES:
        if _ordered_keyword_match(tokens, keyword):
            age_group = _age_group_from_combined(combined_lower)
            return label, age_group

    if first_title:
        age_group = _age_group_from_combined(combined_lower)
        return first_title, age_group

    return "Adult ADHD", "Adult"


# ── Signature verification ─────────────────────────────────────────────────────

def _verify_woo_signature(body: bytes, signature: str | None) -> bool:
    if not signature:
        return False
    expected = hmac.new(
        settings.webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ── Route ──────────────────────────────────────────────────────────────────────

@router.post("/payment", response_model=WebhookResult, status_code=status.HTTP_200_OK)
async def receive_payment_webhook(
    request: Request,
    x_wc_webhook_signature: str | None = Header(default=None),
) -> WebhookResult:
    if not settings.enable_legacy_woocommerce_webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy WooCommerce webhook is disabled on Neuro Flow",
        )
    body = await request.body()

    if settings.environment != "development":
        if not _verify_woo_signature(body, x_wc_webhook_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

    try:
        import json
        data = WooCommercePayload(**json.loads(body))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    billing = data.billing
    client_name = f"{billing.get('first_name', 'Unknown')} {billing.get('last_name', '')}".strip()
    client_email = billing.get("email", "")
    pathway, age_group = detect_pathway(data.line_items)

    client_id = f"CLI-{uuid.uuid4().hex[:8].upper()}"
    assessment_id = f"ASS-{uuid.uuid4().hex[:8].upper()}"

    # In a full implementation this would persist to the database via services.
    # The records are logged here so they appear in the backend console and can
    # be picked up by the booking service in the next step.
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        "Payment webhook received | order=%s client=%s email=%s pathway=%s "
        "age_group=%s amount=%s%s client_id=%s assessment_id=%s",
        data.id, client_name, client_email, pathway, age_group,
        data.currency, data.total, client_id, assessment_id,
    )

    return WebhookResult(
        received=True,
        client_id=client_id,
        assessment_id=assessment_id,
        pathway=pathway,
        next_step="booking",
    )


@router.post("/payment/test", response_model=WebhookResult, status_code=status.HTTP_200_OK)
def test_payment_webhook() -> WebhookResult:
    """Fire a test payload without needing WordPress - useful during setup."""
    require_non_production()
    return WebhookResult(
        received=True,
        client_id=f"CLI-TEST{uuid.uuid4().hex[:4].upper()}",
        assessment_id=f"ASS-TEST{uuid.uuid4().hex[:4].upper()}",
        pathway="Adult ADHD",
        next_step="booking",
    )


# ── Stripe webhook ─────────────────────────────────────────────────────────────

def _verify_stripe_signature(body: bytes, sig_header: str | None, secret: str) -> bool:
    """Verify Stripe-Signature header using HMAC-SHA256."""
    if not sig_header or not secret:
        return False
    try:
        pairs = dict(part.split("=", 1) for part in sig_header.split(","))
        timestamp = pairs.get("t", "")
        v1 = pairs.get("v1", "")
        signed_payload = f"{timestamp}.".encode() + body
        expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
    except Exception:
        return False


def _stripe_pathway_and_age(session: dict, metadata: dict) -> tuple[str, str, str | None, str | None]:
    """
    Resolve (pathway, age_group, child_name, child_dob) from the Stripe checkout context.

    Age group priority (highest → lowest):
      1. child_dob in metadata  → calculate exact age → Child / Adolescent / Adult
      2. explicit age_group metadata field
      3. product/service name keyword inference (Child vs Adult only - no DOB means no Adolescent)

    WordPress checkout should send these metadata keys for under-18 bookings:
      child_dob        - ISO date "YYYY-MM-DD"
      child_first_name - child's first name
      child_last_name  - child's last name
      age_group        - "Child" | "Adolescent" | "Adult"  (optional override)
    """
    chunks: list[str] = []
    for key in ("pathway", "service_name", "product_name", "paid_service_name"):
        v = metadata.get(key)
        if v and str(v).strip():
            chunks.append(str(v).strip())

    line_items = session.get("line_items")
    data: list = []
    if isinstance(line_items, dict):
        data = line_items.get("data") or []
    for item in data:
        if not isinstance(item, dict):
            continue
        desc = (item.get("description") or "").strip()
        if desc:
            chunks.append(desc)
        price = item.get("price")
        if isinstance(price, dict):
            if (price.get("nickname") or "").strip():
                chunks.append((price.get("nickname") or "").strip())
            prod = price.get("product")
            if isinstance(prod, dict) and (prod.get("name") or "").strip():
                chunks.append((prod.get("name") or "").strip())

    if not any(c.strip() for c in chunks):
        return "Adult ADHD", "Adult", None, None

    merged = " · ".join(chunks)
    pathway, age_from_pathway = detect_pathway([LineItem(name=merged, quantity=1, total="0")])

    # ── Child DOB → precise age group (highest priority) ──────────────────────
    child_dob: str | None = str(metadata.get("child_dob") or "").strip() or None
    child_first = str(metadata.get("child_first_name") or "").strip()
    child_last  = str(metadata.get("child_last_name") or "").strip()
    child_name: str | None = f"{child_first} {child_last}".strip() or None

    if child_dob:
        age = _age_from_dob(child_dob)
        age_group = _age_group_from_age(age) if age is not None else age_from_pathway
        return pathway, age_group, child_name, child_dob

    # ── Explicit age_group metadata override ──────────────────────────────────
    explicit = str(metadata.get("age_group") or "").strip().lower()
    if explicit:
        if explicit in ("child", "minor"):
            return pathway, "Child", child_name, None
        if explicit in ("adolescent", "teen", "teenager"):
            return pathway, "Adolescent", child_name, None
        return pathway, "Adult", None, None

    # ── Fall back to product-name inference ───────────────────────────────────
    return pathway, age_from_pathway, child_name, child_dob


def _extract_paid_service_name(session: dict, metadata: dict, pathway: str) -> str:
    """Human-readable service title from Stripe metadata or line items (falls back to pathway)."""
    for key in ("service_name", "paid_service_name", "product_name"):
        v = metadata.get(key)
        if v and str(v).strip():
            return str(v).strip()
    items = session.get("line_items")
    data: list = []
    if isinstance(items, dict):
        data = items.get("data") or []
    descriptions: list[str] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        desc = (item.get("description") or "").strip()
        if desc:
            descriptions.append(desc)
            continue
        price = item.get("price")
        if isinstance(price, dict):
            nick = (price.get("nickname") or "").strip()
            if nick:
                descriptions.append(nick)
    if descriptions:
        return " · ".join(descriptions[:5])
    return pathway


@router.post("/stripe", response_model=WebhookResult, status_code=status.HTTP_200_OK)
async def receive_stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> WebhookResult:
    """Handle legacy patient Stripe checkout (disabled on standalone Neuro Flow)."""
    if not settings.enable_legacy_woocommerce_webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy patient payment webhook is disabled. Clinics subscribe via /api/v1/subscriptions.",
        )
    import json
    import logging

    logger = logging.getLogger(__name__)
    body = await request.body()

    if settings.environment != "development":
        if not _verify_stripe_signature(body, stripe_signature, settings.stripe_webhook_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Stripe webhook signature",
            )

    try:
        event = json.loads(body)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    if event.get("type") != "checkout.session.completed":
        return WebhookResult(received=True, client_id="", assessment_id="", pathway="", next_step="ignored")

    session = event.get("data", {}).get("object", {})
    session_id = session.get("id", "")
    customer_details = session.get("customer_details", {})
    client_name = customer_details.get("name", "Unknown")
    client_email = customer_details.get("email", "")
    amount = session.get("amount_total", 0)
    currency = session.get("currency", "gbp").upper()

    metadata = session.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    # ── Enrich from PendingCheckout if client_reference_id is a PC- token ─────
    pending_ref: str | None = session.get("client_reference_id") or None
    pending: PendingCheckout | None = None
    if pending_ref and str(pending_ref).startswith("PC-"):
        pending = db.query(PendingCheckout).filter(PendingCheckout.id == pending_ref).first()

    if pending:
        # Prefer form-captured email and name over Stripe's (Stripe only knows the payer)
        if pending.email:
            client_email = pending.email
        full = f"{pending.first_name or ''} {pending.last_name or ''}".strip()
        if full:
            client_name = full
        # Inject child details into the metadata dict so _stripe_pathway_and_age can use them
        if pending.for_child:
            if pending.child_dob:
                metadata.setdefault("child_dob", pending.child_dob)
            if pending.child_first_name:
                metadata.setdefault("child_first_name", pending.child_first_name)
            if pending.child_last_name:
                metadata.setdefault("child_last_name", pending.child_last_name)
        if pending.service_key and not metadata.get("service_name"):
            metadata["service_name"] = pending.service_key
        logger.info(
            "PendingCheckout resolved | ref=%s email=%s for_child=%s child_dob=%s",
            pending_ref, client_email, pending.for_child, pending.child_dob or "-",
        )

    pathway, age_group, child_name, child_dob = _stripe_pathway_and_age(session, metadata)

    # Deduplicate by Stripe session ID
    existing = db.query(ClientRecord).filter(ClientRecord.stripe_session_id == session_id).first()
    if existing:
        logger.info("Stripe webhook duplicate | session=%s already recorded as client=%s", session_id, existing.id)
        return WebhookResult(
            received=True,
            client_id=existing.id,
            assessment_id=existing.assessment_id or "",
            pathway=existing.pathway or pathway,
            next_step="booking",
        )

    client_id = f"CLI-{uuid.uuid4().hex[:8].upper()}"
    assessment_id = f"ASS-{uuid.uuid4().hex[:8].upper()}"

    paid_service_name = _extract_paid_service_name(session, metadata, pathway)

    client = ClientRecord(
        id=client_id,
        full_name=client_name,
        email=client_email,
        phone=(pending.phone or None) if pending else None,
        pathway=pathway,
        age_group=age_group,
        child_name=child_name,
        child_dob=child_dob,
        status="New",
        stage="Intake",
        source="stripe",
        stripe_session_id=session_id,
        payment_amount=str(amount / 100),
        payment_currency=currency,
        assessment_id=assessment_id,
        paid_service_name=paid_service_name,
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    logger.info(
        "Stripe payment saved | session=%s client=%s email=%s pathway=%s "
        "age_group=%s child_name=%s child_dob=%s service=%s amount=%s%s client_id=%s assessment_id=%s",
        session_id, client_name, client_email, pathway, age_group,
        child_name or "-", child_dob or "-",
        paid_service_name, currency, amount / 100, client_id, assessment_id,
    )

    # Dispatch forms: universal intake first, then age-group-specific questionnaire
    primary_form_type = _primary_form_for_age_group(age_group)
    invoice_service_label = paid_service_name if paid_service_name else pathway
    from app.api.v1.forms import _dispatch_form

    _dispatch_form(
        db=db,
        client_id=client_id,
        form_type=FORM_BASIC_INTAKE,
        recipient_email=client_email,
        recipient_name=client_name,
        client_name=client_name,
        assessment_type=invoice_service_label,
        amount=str(amount / 100),
        currency=currency,
        reference=assessment_id,
    )
    _dispatch_form(
        db=db,
        client_id=client_id,
        form_type=primary_form_type,
        recipient_email=client_email,
        recipient_name=client_name,
        client_name=client_name,
        assessment_type=pathway,
        amount=str(amount / 100),
        currency=currency,
        reference=assessment_id,
        paid_service_name=paid_service_name,
    )
    client.status = "Forms Sent"
    db.commit()
    logger.info(
        "Forms dispatched | client=%s age_group=%s basic_intake + %s",
        client_id, age_group, primary_form_type,
    )

    return WebhookResult(
        received=True,
        client_id=client_id,
        assessment_id=assessment_id,
        pathway=pathway,
        next_step="booking",
    )


@router.post("/stripe/test", response_model=WebhookResult, status_code=status.HTTP_200_OK)
def test_stripe_webhook() -> WebhookResult:
    """Fire a mock Stripe checkout.session.completed without real payment."""
    require_non_production()
    return WebhookResult(
        received=True,
        client_id=f"CLI-TEST{uuid.uuid4().hex[:4].upper()}",
        assessment_id=f"ASS-TEST{uuid.uuid4().hex[:4].upper()}",
        pathway="Adult ADHD",
        next_step="booking",
    )
