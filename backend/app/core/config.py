from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve backend/.env regardless of process cwd (uvicorn may start elsewhere).
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Neuro Flow Clinical Platform"
    app_version: str = "2.0.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./neuro_flow.db"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"
    log_level: str = "INFO"

    # ── Neuro Flow branding ───────────────────────────────────────────────────
    platform_display_name: str = "Neuro Flow"
    platform_tagline: str = "NICE-aligned neurodevelopmental assessment for clinics"
    support_email: str = "support@neuroflow.app"
    auth_cookie_name: str = "neuroflow_token"
    auth_user_cookie_name: str = "neuroflow_user"
    legacy_auth_cookie_name: str = "neuroaccess_token"

    # JWT authentication
    jwt_secret: str = "neuroflow-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480  # 8 hours

    # Signup trial (days) when Stripe is not configured
    signup_trial_days: int = 14
    allow_public_signup: bool = True

    # Legacy WordPress / WooCommerce intake (disabled for standalone Neuro Flow)
    enable_legacy_woocommerce_webhook: bool = False
    webhook_secret: str = "legacy-webhook-secret-change-in-production"

    # Stripe — clinic subscriptions (Billing), not patient checkout
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_professional: str = ""
    stripe_price_enterprise: str = ""

    # SendGrid - leave blank in local dev to log emails to console instead
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@neuroflow.app"

    # Platform base URL - used in form links and email CTAs
    platform_base_url: str = "http://localhost:3004"

    # Admin notification email - receives "all forms returned" alerts
    admin_notification_email: str = "admin@neuroflow.app"

    # Client document uploads (PDF, images, DOCX). Relative paths resolve under backend dir.
    document_upload_dir: str = ""

    # ChromaDB vector store — persists embeddings for RAG
    chroma_persist_dir: str = ""          # defaults to {backend_dir}/chroma_db
    embedding_model: str = "all-MiniLM-L6-v2"  # sentence-transformers model

    # OCR
    tesseract_cmd: str = ""               # override system tesseract path if needed

    # Optional: one URL used for all session confirmation emails (Zoom / Google Meet recurring link).
    static_video_meeting_url: str = ""

    zoom_account_id: str = ""
    zoom_client_id: str = ""
    zoom_client_secret: str = ""

    # CORS
    frontend_url: str = "http://localhost:3004"
    extra_cors_origins: str = ""  # comma-separated

    # Deprecated legacy origins (ignored unless legacy webhooks enabled)
    wordpress_staging_url: str = ""
    wordpress_production_url: str = ""

    # Auth0 (optional production IdP + Management API for scripts/setup-auth0.js)
    auth0_domain: str = ""
    auth0_audience: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = ""
    auth0_mgmt_client_id: str = ""
    auth0_mgmt_client_secret: str = ""
    auth0_connection: str = "Username-Password-Authentication"
    auth0_algorithms: list[str] = ["RS256"]

    @field_validator("sendgrid_api_key", "sendgrid_from_email", mode="before")
    @classmethod
    def strip_whitespace(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    def is_production(self) -> bool:
        from app.core.production import is_production_env

        return is_production_env(self.environment)

    def cors_origins(self) -> list[str]:
        origins = [self.frontend_url, self.platform_base_url]
        if not self.is_production():
            origins.extend(
                [
                    "http://localhost:3004",
                    "http://localhost:3000",
                    "http://127.0.0.1:3004",
                ]
            )
            if self.wordpress_staging_url:
                origins.append(self.wordpress_staging_url)
            if self.wordpress_production_url:
                origins.append(self.wordpress_production_url)
        for part in self.extra_cors_origins.split(","):
            p = part.strip()
            if p:
                origins.append(p)
        return list(dict.fromkeys(o for o in origins if o))

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def document_upload_root() -> Path:
    raw = (settings.document_upload_dir or "").strip()
    if raw:
        p = Path(raw)
        base = p.resolve() if p.is_absolute() else (_BACKEND_DIR / p).resolve()
    else:
        base = (_BACKEND_DIR / "uploads").resolve()
    base.mkdir(parents=True, exist_ok=True)
    return base
