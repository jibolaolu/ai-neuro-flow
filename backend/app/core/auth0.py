"""Auth0 access-token validation via JWKS (RS256)."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

from jose import JWTError, jwk, jwt

from app.core.config import settings

_JWKS_CACHE: dict | None = None
_JWKS_CACHE_AT: float = 0.0
_JWKS_TTL_SECONDS = 3600


def auth0_enabled() -> bool:
    return bool(settings.auth0_domain.strip() and settings.auth0_audience.strip())


def auth0_issuer() -> str:
    domain = settings.auth0_domain.strip().rstrip("/")
    if domain.startswith("https://"):
        base = domain
    else:
        base = f"https://{domain}"
    return base if base.endswith("/") else f"{base}/"


def _jwks_url() -> str:
    domain = settings.auth0_domain.strip().rstrip("/")
    if domain.startswith("https://"):
        host = domain
    else:
        host = f"https://{domain}"
    return f"{host}/.well-known/jwks.json"


def _get_jwks() -> dict:
    global _JWKS_CACHE, _JWKS_CACHE_AT
    now = time.time()
    if _JWKS_CACHE and (now - _JWKS_CACHE_AT) < _JWKS_TTL_SECONDS:
        return _JWKS_CACHE
    req = urllib.request.Request(_jwks_url(), headers={"User-Agent": "neuroflow-api"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
        raise JWTError(f"Unable to fetch Auth0 JWKS: {exc}") from exc
    _JWKS_CACHE = data
    _JWKS_CACHE_AT = now
    return data


def decode_auth0_token(token: str) -> dict:
    """Validate Auth0-issued access token. Raises JWTError on failure."""
    if not auth0_enabled():
        raise JWTError("Auth0 is not configured")

    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise JWTError("Token missing key id")

    jwks = _get_jwks()
    rsa_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            rsa_key = jwk.construct(key)
            break
    if rsa_key is None:
        raise JWTError("Unable to find matching JWKS key")

    return jwt.decode(
        token,
        rsa_key,
        algorithms=settings.auth0_algorithms,
        audience=settings.auth0_audience.strip(),
        issuer=auth0_issuer(),
        options={"verify_at_hash": False},
    )


def email_from_claims(claims: dict) -> str | None:
    email = claims.get("email")
    if isinstance(email, str) and email.strip():
        return email.strip().lower()
    for key, value in claims.items():
        if key.endswith("/email") and isinstance(value, str) and value.strip():
            return value.strip().lower()
    return None
