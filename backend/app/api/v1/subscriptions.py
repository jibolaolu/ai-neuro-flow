"""Clinic subscription billing via Stripe (organizations pay; patients do not)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.config import settings
from app.core.production import is_production_env
from app.models.organization import (
    PLAN_ENTERPRISE,
    PLAN_PROFESSIONAL,
    PLAN_STARTER,
    SUB_ACTIVE,
    SUB_CANCELED,
    SUB_PAST_DUE,
    SUB_TRIALING,
    OrganizationOut,
    OrganizationRecord,
)
from app.models.user import UserRecord
from app.services import stripe_billing
from app.services.tenant import get_organization, require_clinic_member

router = APIRouter()
logger = logging.getLogger(__name__)

PLANS = [
    {
        "id": PLAN_STARTER,
        "name": "Starter",
        "description": "Up to 3 clinicians, core assessment workflows",
        "price_gbp_monthly": 149,
        "stripe_price_env": "stripe_price_starter",
    },
    {
        "id": PLAN_PROFESSIONAL,
        "name": "Professional",
        "description": "Up to 15 clinicians, AI reports, senior sign-off",
        "price_gbp_monthly": 349,
        "stripe_price_env": "stripe_price_professional",
    },
    {
        "id": PLAN_ENTERPRISE,
        "name": "Enterprise",
        "description": "Unlimited seats, API access, dedicated support",
        "price_gbp_monthly": 799,
        "stripe_price_env": "stripe_price_enterprise",
    },
]


class CheckoutBody(BaseModel):
    plan: str


def _price_id_for_plan(plan: str) -> str:
    mapping = {
        PLAN_STARTER: settings.stripe_price_starter,
        PLAN_PROFESSIONAL: settings.stripe_price_professional,
        PLAN_ENTERPRISE: settings.stripe_price_enterprise,
    }
    pid = mapping.get(plan, "").strip()
    if not pid:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price not configured for plan '{plan}'",
        )
    return pid


@router.get("/plans")
def list_plans() -> dict:
    return {
        "plans": [
            {k: v for k, v in p.items() if k != "stripe_price_env"} for p in PLANS
        ],
        "stripe_enabled": stripe_billing.stripe_configured(),
        "trial_days": settings.signup_trial_days,
    }


@router.get("/status", response_model=OrganizationOut)
def subscription_status(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin")),
) -> OrganizationOut:
    cid = require_clinic_member(user)
    org = get_organization(db, cid)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationOut.model_validate(org)


@router.post("/checkout")
def create_subscription_checkout(
    body: CheckoutBody,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin")),
) -> dict:
    if not stripe_billing.stripe_configured():
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Your trial remains active until it expires.",
        )
    if body.plan not in (PLAN_STARTER, PLAN_PROFESSIONAL, PLAN_ENTERPRISE):
        raise HTTPException(status_code=400, detail="Invalid plan")

    cid = require_clinic_member(user)
    org = get_organization(db, cid)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    price_id = _price_id_for_plan(body.plan)
    if not org.stripe_customer_id:
        org.stripe_customer_id = stripe_billing.create_customer(
            email=user.email,
            name=org.name,
            metadata={"organization_id": org.id, "slug": org.slug},
        )
        db.commit()

    base = settings.platform_base_url.rstrip("/")
    session = stripe_billing.create_checkout_session(
        customer_id=org.stripe_customer_id,
        price_id=price_id,
        success_url=f"{base}/clinic-admin/subscription?subscription=success",
        cancel_url=f"{base}/pricing?subscription=canceled",
        metadata={"organization_id": org.id, "plan": body.plan},
    )
    return {"checkout_url": session.get("url"), "session_id": session.get("id")}


@router.post("/portal")
def billing_portal(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin")),
) -> dict:
    if not stripe_billing.stripe_configured():
        raise HTTPException(status_code=503, detail="Stripe not configured")
    cid = require_clinic_member(user)
    org = get_organization(db, cid)
    if not org or not org.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account yet")
    base = settings.platform_base_url.rstrip("/")
    session = stripe_billing.create_billing_portal_session(
        org.stripe_customer_id,
        f"{base}/clinic-admin",
    )
    return {"portal_url": session.get("url")}


def _verify_stripe_signature(payload: bytes, sig_header: str | None, secret: str) -> bool:
    if not secret or not sig_header:
        return False
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        timestamp = parts.get("t", "")
        v1 = parts.get("v1", "")
        signed = f"{timestamp}.{payload.decode()}"
        expected = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
    except Exception:
        return False


@router.post("/webhook")
async def stripe_subscription_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict:
    body = await request.body()
    secret = settings.stripe_webhook_secret.strip()
    if is_production_env(settings.environment):
        if not secret:
            raise HTTPException(status_code=503, detail="Stripe webhook not configured")
        if not _verify_stripe_signature(body, stripe_signature, secret):
            raise HTTPException(status_code=400, detail="Invalid signature")
    elif secret and not _verify_stripe_signature(body, stripe_signature, secret):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc
    etype = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if etype == "checkout.session.completed" and data.get("mode") == "subscription":
        org_id = (data.get("metadata") or {}).get("organization_id")
        plan = (data.get("metadata") or {}).get("plan")
        sub_id = data.get("subscription")
        customer_id = data.get("customer")
        if org_id:
            org = db.query(OrganizationRecord).filter(OrganizationRecord.id == org_id).first()
            if org:
                org.subscription_status = SUB_ACTIVE
                org.subscription_plan = plan or org.subscription_plan
                org.stripe_subscription_id = sub_id or org.stripe_subscription_id
                if customer_id:
                    org.stripe_customer_id = customer_id
                db.commit()
                logger.info("Subscription activated | org=%s plan=%s", org_id, plan)

    elif etype == "customer.subscription.updated":
        sub = data
        org_id = (sub.get("metadata") or {}).get("organization_id")
        status_map = {
            "active": SUB_ACTIVE,
            "trialing": SUB_TRIALING,
            "past_due": SUB_PAST_DUE,
            "canceled": SUB_CANCELED,
            "unpaid": SUB_PAST_DUE,
        }
        st = status_map.get(sub.get("status", ""), SUB_PAST_DUE)
        if org_id:
            org = db.query(OrganizationRecord).filter(OrganizationRecord.id == org_id).first()
            if org:
                org.subscription_status = st
                org.stripe_subscription_id = sub.get("id") or org.stripe_subscription_id
                db.commit()

    elif etype == "customer.subscription.deleted":
        sub = data
        org_id = (sub.get("metadata") or {}).get("organization_id")
        if org_id:
            org = db.query(OrganizationRecord).filter(OrganizationRecord.id == org_id).first()
            if org:
                org.subscription_status = SUB_CANCELED
                db.commit()

    return {"received": True}
