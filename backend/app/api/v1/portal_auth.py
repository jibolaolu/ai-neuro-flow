"""
Magic-link authentication for the client portal.

Flow:
  1. Staff calls POST /portal/generate-link/{client_id} → magic link emailed to client
  2. Client clicks link → Next.js /client-portal/login?token=...
  3. Next.js calls POST /public/portal/authenticate?token=... → sets HttpOnly session cookie
  4. Portal pages use cookie via _get_client_by_token in client_comms.py
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.config import settings
from app.models.client import ClientRecord
from app.models.user import UserRecord

logger = logging.getLogger(__name__)

public_router = APIRouter()
staff_router = APIRouter()

_MAGIC_TTL_HOURS = 48
_SESSION_TTL_DAYS = 7
_PORTAL_COOKIE = "portal_session"


@staff_router.post("/portal/generate-link/{client_id}")
def generate_portal_link(
    client_id: str,
    db: Session = Depends(get_db),
    _actor: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "clinician", "senior-clinician",
    )),
) -> dict:
    """Generate a 48-hour magic link and email it to the client."""
    client = db.query(ClientRecord).filter(ClientRecord.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    magic_token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(hours=_MAGIC_TTL_HOURS)

    client.portal_magic_token = magic_token
    client.portal_magic_token_expires_at = expires
    db.commit()

    base = settings.platform_base_url.rstrip("/")
    login_url = f"{base}/client-portal/login?token={magic_token}"
    expires_display = expires.strftime("%d %b %Y at %H:%M UTC")

    # Attempt to send email (non-fatal if email service not configured)
    try:
        from app.services import email as email_svc  # type: ignore[import]
        email_svc.send_portal_login_link(
            to_email=client.email,
            client_name=client.full_name,
            client_id=client.id,
            login_url=login_url,
            expires_at=expires_display,
        )
    except Exception as exc:
        logger.warning("[portal-auth] email send failed (non-fatal): %s", exc)

    return {
        "login_url": login_url,
        "expires_at": expires.isoformat(),
        "ttl_hours": _MAGIC_TTL_HOURS,
        "client_id": client.id,
        "client_name": client.full_name,
    }


@public_router.post("/portal/authenticate")
def portal_authenticate(token: str, response: Response, db: Session = Depends(get_db)) -> dict:
    """Exchange magic token for a 7-day session cookie."""
    client = db.query(ClientRecord).filter(ClientRecord.portal_magic_token == token).first()
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or expired login link")
    if getattr(client, "is_active", "true") == "false":
        raise HTTPException(status_code=403, detail="This portal is no longer active")
    expires_at = client.portal_magic_token_expires_at
    if not expires_at or datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=401, detail="This login link has expired. Please request a new one.")

    session_token = secrets.token_urlsafe(48)
    session_expires = datetime.now(timezone.utc) + timedelta(days=_SESSION_TTL_DAYS)

    client.portal_session_token = session_token
    client.portal_session_expires_at = session_expires
    db.commit()

    response.set_cookie(
        key=_PORTAL_COOKIE,
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=_SESSION_TTL_DAYS * 24 * 3600,
        path="/",
    )

    return {
        "ok": True,
        "client_id": client.id,
        "client_name": client.full_name,
        "session_expires_at": session_expires.isoformat(),
    }


@public_router.get("/portal/me")
def portal_me(request: Request, db: Session = Depends(get_db)) -> dict:
    """Return current portal client context from session cookie."""
    session_val = request.cookies.get(_PORTAL_COOKIE)
    if not session_val:
        raise HTTPException(status_code=401, detail="Not authenticated")
    client = db.query(ClientRecord).filter(ClientRecord.portal_session_token == session_val).first()
    if not client:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    expires_at = client.portal_session_expires_at
    if expires_at and datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    return {
        "client_id": client.id,
        "client_name": client.full_name,
        "pathway": client.pathway,
        "status": client.status,
        "stage": client.stage,
    }


@public_router.post("/portal/logout")
def portal_logout(response: Response, request: Request, db: Session = Depends(get_db)) -> dict:
    """Clear the portal session."""
    session_val = request.cookies.get(_PORTAL_COOKIE)
    if session_val:
        client = db.query(ClientRecord).filter(ClientRecord.portal_session_token == session_val).first()
        if client:
            client.portal_session_token = None
            client.portal_session_expires_at = None
            db.commit()
    response.delete_cookie(key=_PORTAL_COOKIE, path="/")
    return {"ok": True}
