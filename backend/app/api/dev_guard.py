"""Block demo-only API routes in production."""

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.production import is_production_env


def require_non_production() -> None:
    if is_production_env(settings.environment):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
