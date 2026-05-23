"""Stripe Billing for clinic subscriptions (not patient payments)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from app.core.config import settings

logger = logging.getLogger(__name__)

STRIPE_API = "https://api.stripe.com/v1"


def stripe_configured() -> bool:
    return bool(settings.stripe_secret_key.strip())


def _request(method: str, path: str, data: dict | None = None) -> dict:
    key = settings.stripe_secret_key.strip()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    url = f"{STRIPE_API}{path}"
    body = urllib.parse.urlencode(_flatten(data or {})).encode() if data else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        logger.error("Stripe API error %s: %s", e.code, err_body)
        raise RuntimeError(f"Stripe error: {err_body}") from e


def _flatten(d: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}[{k}]" if prefix else k
        if isinstance(v, dict):
            out.update(_flatten(v, key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    out.update(_flatten(item, f"{key}[{i}]"))
                else:
                    out[f"{key}[{i}]"] = str(item)
        elif v is not None:
            out[key] = str(v)
    return out


def create_customer(email: str, name: str, metadata: dict[str, str]) -> str:
    result = _request(
        "POST",
        "/customers",
        {"email": email, "name": name, "metadata": metadata},
    )
    return result["id"]


def create_checkout_session(
    *,
    customer_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
    metadata: dict[str, str],
) -> dict:
    return _request(
        "POST",
        "/checkout/sessions",
        {
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": metadata,
            "subscription_data": {"metadata": metadata},
        },
    )


def create_billing_portal_session(customer_id: str, return_url: str) -> dict:
    return _request(
        "POST",
        "/billing_portal/sessions",
        {"customer": customer_id, "return_url": return_url},
    )
