"""
Platform system status - Super Platform Admin only.
Returns live infrastructure health, DB connectivity, config summary,
and registered user counts per role.
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.config import settings
from app.core.production import _INSECURE_JWT_SECRETS, _INSECURE_WEBHOOK_SECRETS
from app.models.user import UserRecord, UserRole

router = APIRouter()

_start_time = time.time()


class ServiceCheck(BaseModel):
    name: str
    status: str          # "ok" | "degraded" | "error"
    detail: str


class RoleCount(BaseModel):
    role: str
    count: int


class SystemStatus(BaseModel):
    environment: str
    app_version: str
    uptime_seconds: float
    checked_at: str
    services: list[ServiceCheck]
    role_counts: list[RoleCount]
    config_summary: dict[str, str]


@router.get("/status", response_model=SystemStatus)
def get_system_status(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("super-platform-admin")),
) -> SystemStatus:
    services: list[ServiceCheck] = []

    # ── Database connectivity ──────────────────────────────────────────────────
    try:
        db.execute(text("SELECT 1"))
        db_type = "SQLite" if "sqlite" in settings.database_url else "PostgreSQL"
        services.append(ServiceCheck(name="Database", status="ok", detail=f"{db_type} - connection healthy"))
    except Exception as exc:
        services.append(ServiceCheck(name="Database", status="error", detail=str(exc)))

    # ── Auth ─────────────────────────────────────────────────────────────────────
    from app.core.auth0 import auth0_enabled

    if auth0_enabled():
        services.append(ServiceCheck(
            name="Auth0",
            status="ok",
            detail="RS256 access tokens via Auth0",
        ))
    else:
        jwt_configured = bool(settings.jwt_secret and settings.jwt_secret not in _INSECURE_JWT_SECRETS)
        services.append(ServiceCheck(
            name="Local JWT (dev)",
            status="ok" if jwt_configured else "degraded",
            detail="Password login for development — set AUTH0_DOMAIN + AUTH0_AUDIENCE in production",
        ))

    # ── Webhook secret ─────────────────────────────────────────────────────────
    webhook_configured = bool(
        settings.webhook_secret and settings.webhook_secret not in _INSECURE_WEBHOOK_SECRETS
    )
    services.append(ServiceCheck(
        name="Webhook Secret",
        status="ok" if webhook_configured else "degraded",
        detail="Secret configured" if webhook_configured else "Using default dev secret - set WEBHOOK_SECRET in production",
    ))

    # ── Stripe ────────────────────────────────────────────────────────────────
    stripe_configured = bool(settings.stripe_webhook_secret)
    services.append(ServiceCheck(
        name="Stripe Webhook",
        status="ok" if stripe_configured else "degraded",
        detail="Signing secret configured" if stripe_configured else "STRIPE_WEBHOOK_SECRET not set",
    ))

    # ── SendGrid (transactional email) ───────────────────────────────────────
    sendgrid_configured = bool(getattr(settings, "sendgrid_api_key", ""))
    services.append(ServiceCheck(
        name="SendGrid",
        status="ok" if sendgrid_configured else "degraded",
        detail=(
            f"API key loaded - from {settings.sendgrid_from_email}"
            if sendgrid_configured
            else "SENDGRID_API_KEY empty - emails logged only, not delivered"
        ),
    ))

    # ── Role counts ────────────────────────────────────────────────────────────
    role_counts: list[RoleCount] = []
    for role in UserRole:
        count = db.query(UserRecord).filter(UserRecord.role == role.value, UserRecord.is_active == True).count()  # noqa: E712
        role_counts.append(RoleCount(role=role.value, count=count))

    # ── Config summary (non-sensitive) ────────────────────────────────────────
    config_summary = {
        "environment": settings.environment,
        "api_version": settings.app_version,
        "database": "SQLite (dev)" if "sqlite" in settings.database_url else "PostgreSQL",
        "frontend_url": settings.frontend_url,
        "wordpress_production": settings.wordpress_production_url,
        "wordpress_staging": settings.wordpress_staging_url,
        "jwt_expiry": f"{settings.jwt_expiry_minutes} minutes",
        "cors_origins": f"{settings.frontend_url}, {settings.wordpress_production_url}",
        "sendgrid": "configured" if getattr(settings, "sendgrid_api_key", "") else "not configured",
        "platform_base_url": getattr(settings, "platform_base_url", ""),
    }

    return SystemStatus(
        environment=settings.environment,
        app_version=settings.app_version,
        uptime_seconds=round(time.time() - _start_time, 1),
        checked_at=datetime.now(timezone.utc).isoformat(),
        services=services,
        role_counts=role_counts,
        config_summary=config_summary,
    )
