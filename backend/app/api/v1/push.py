"""
Web Push subscription management.
Stores push subscriptions per user so the backend can send push notifications.
Gracefully skips actual push delivery if pywebpush is not installed.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory fallback store (single-process only — fine for dev/demo)
# In production, persist to DB table: (user_id, endpoint, keys_json)
_subscriptions: dict[str, list[dict]] = {}


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: float | None = None


class PushPayload(BaseModel):
    title: str
    body: str
    url: str = "/"
    tag: str | None = None


@router.post("/subscribe", status_code=204)
def subscribe(
    sub: PushSubscription,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    user_id = str(user.id)
    existing = _subscriptions.setdefault(user_id, [])
    # Deduplicate by endpoint
    if not any(s["endpoint"] == sub.endpoint for s in existing):
        existing.append(sub.model_dump())
    return None


@router.delete("/unsubscribe", status_code=204)
def unsubscribe(
    sub: PushSubscription,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    user_id = str(user.id)
    _subscriptions[user_id] = [
        s for s in _subscriptions.get(user_id, []) if s["endpoint"] != sub.endpoint
    ]
    return None


def send_push_to_user(user_id: str, payload: dict) -> int:
    """
    Send a push notification to all subscriptions for a user.
    Returns the number of subscriptions notified.
    Silently skips if pywebpush not installed or VAPID keys not configured.
    """
    subs = _subscriptions.get(str(user_id), [])
    if not subs:
        return 0

    try:
        from pywebpush import webpush, WebPushException  # type: ignore
        import os

        vapid_private = os.getenv("VAPID_PRIVATE_KEY")
        vapid_email = os.getenv("VAPID_EMAIL", "mailto:admin@neuroflow.health")
        if not vapid_private:
            logger.debug("VAPID_PRIVATE_KEY not set — skipping push send")
            return 0

        sent = 0
        dead = []
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": sub.get("keys", {}),
                    },
                    data=json.dumps(payload),
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": vapid_email},
                )
                sent += 1
            except WebPushException as exc:
                if exc.response and exc.response.status_code in (404, 410):
                    dead.append(sub["endpoint"])
                else:
                    logger.warning("Push send failed: %s", exc)

        # Prune dead endpoints
        if dead:
            _subscriptions[str(user_id)] = [
                s for s in subs if s["endpoint"] not in dead
            ]
        return sent

    except ImportError:
        logger.debug("pywebpush not installed — push notifications disabled")
        return 0
