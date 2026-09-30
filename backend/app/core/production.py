"""Production startup validation and shared guards."""

from __future__ import annotations

import sys

from app.core.config import Settings

# Known insecure defaults — must not be used when ENVIRONMENT=production
_INSECURE_JWT_SECRETS = frozenset(
    {
        "neuroflow-dev-secret-change-in-production",
        "neuroaccess-dev-secret-change-in-production",
        "change-me-in-production",
    }
)
_INSECURE_WEBHOOK_SECRETS = frozenset(
    {
        "legacy-webhook-secret-change-in-production",
        "neuroflow-webhook-secret-change-in-production",
        "neuroaccess-webhook-secret-change-in-production",
    }
)


def is_production_env(environment: str) -> bool:
    return environment.strip().lower() in ("production", "prod")


def is_sqlite_url(database_url: str) -> bool:
    return database_url.strip().lower().startswith("sqlite")


def validate_production_settings(s: Settings) -> None:
    """Fail fast on unsafe configuration. Call during application startup."""
    if not is_production_env(s.environment):
        return

    errors: list[str] = []

    if not (s.auth0_domain.strip() and s.auth0_audience.strip()):
        errors.append("AUTH0_DOMAIN and AUTH0_AUDIENCE are required in production")

    if is_sqlite_url(s.database_url):
        errors.append("DATABASE_URL must use PostgreSQL in production (sqlite is dev-only)")

    if not s.frontend_url.startswith("https://"):
        errors.append("FRONTEND_URL must use https:// in production")
    if not s.platform_base_url.startswith("https://"):
        errors.append("PLATFORM_BASE_URL must use https:// in production")

    if s.enable_legacy_woocommerce_webhook:
        errors.append("ENABLE_LEGACY_WOOCOMMERCE_WEBHOOK must be false in production")

    if s.stripe_secret_key.strip() and not s.stripe_webhook_secret.strip():
        errors.append("STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set")

    for url in (s.frontend_url, s.platform_base_url):
        if "localhost" in url or "127.0.0.1" in url:
            errors.append(f"Production URL must not be localhost: {url}")

    if errors:
        msg = "Production configuration invalid:\n  - " + "\n  - ".join(errors)
        print(msg, file=sys.stderr)
        raise RuntimeError(msg)
