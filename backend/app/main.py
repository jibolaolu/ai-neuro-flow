import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, log_request
from app.core.production import validate_production_settings
from app.db.base import Base
from app.db.session import engine
from app.db.sqlite_migrate import ensure_sqlite_columns
from app.middleware.security import SecurityHeadersMiddleware

configure_logging()

logger = logging.getLogger("app.main")

_docs = None if settings.is_production else "/docs"
_redoc = None if settings.is_production else "/redoc"

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url=_docs,
    redoc_url=_redoc,
)

_cors_origins = settings.cors_origins()
_cors_regex = (
    r"https?://([\w-]+\.)*localtest\.me(:\d+)?$"
    if settings.environment == "development"
    else None
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Stripe-Signature", "X-WC-Webhook-Signature"],
)


@app.middleware("http")
async def request_logger_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    if request.url.path not in ("/health", "/ready"):
        log_request(request.method, request.url.path, response.status_code, duration_ms)
    return response


app.include_router(api_router, prefix=settings.api_prefix)


@app.on_event("startup")
def startup() -> None:
    validate_production_settings(settings)
    Base.metadata.create_all(bind=engine)
    if settings.database_url.lower().startswith("sqlite"):
        ensure_sqlite_columns(engine)
    from app.services.scheduler import start_scheduler

    start_scheduler()
    if not settings.is_production():
        from app.db.tenant_migrate import ensure_default_organization

        ensure_default_organization(engine)
    logger.info("%s API ready | env=%s", settings.platform_display_name, settings.environment)


@app.on_event("shutdown")
def shutdown() -> None:
    from app.services.scheduler import stop_scheduler

    stop_scheduler()
    engine.dispose()
    logger.info("%s API shutting down", settings.platform_display_name)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness — process is up."""
    return {"status": "ok"}


@app.get("/ready")
def readiness_check() -> dict[str, str]:
    """Readiness — database reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("Readiness check failed")
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ready"}
