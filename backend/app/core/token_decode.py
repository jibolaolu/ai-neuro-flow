"""Unified token decoding: Auth0 (production) or local HS256 (development)."""

from __future__ import annotations

from jose import JWTError

from app.core.auth0 import auth0_enabled, decode_auth0_token
from app.core.config import settings
from app.core.security import decode_access_token

TokenSource = str  # "auth0" | "local"


def decode_token(token: str) -> tuple[dict, TokenSource]:
    """
    Decode bearer token.
    Production with Auth0 configured: Auth0 tokens only.
    Development: try Auth0 first if configured, then local JWT.
    """
    if auth0_enabled():
        try:
            return decode_auth0_token(token), "auth0"
        except JWTError:
            if settings.is_production():
                raise
            # Dev: fall through to local JWT (mock auth, signup, etc.)

    if settings.is_production():
        raise JWTError("Auth0 is required in production")

    return decode_access_token(token), "local"
