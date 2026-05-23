"""Auth0 token decode tests (no network — JWKS mocked)."""

from unittest.mock import patch

import pytest
from jose import jwt

from app.core.auth0 import decode_auth0_token, email_from_claims
from app.core.config import Settings


@pytest.fixture
def auth0_settings(monkeypatch):
    s = Settings(
        auth0_domain="tenant.eu.auth0.com",
        auth0_audience="https://neuroflow-api",
    )
    monkeypatch.setattr("app.core.auth0.settings", s)
    return s


def test_email_from_claims():
    assert email_from_claims({"email": "User@Clinic.test"}) == "user@clinic.test"
    assert email_from_claims({"https://neuroflow.app/email": "a@b.co"}) == "a@b.co"
    assert email_from_claims({"sub": "auth0|1"}) is None


def test_decode_rejects_when_auth0_not_configured(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth0.settings",
        Settings(auth0_domain="", auth0_audience=""),
    )
    with pytest.raises(Exception, match="not configured"):
        decode_auth0_token("invalid.token.here")
