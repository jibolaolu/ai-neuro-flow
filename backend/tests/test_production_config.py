import pytest

from app.core.config import Settings
from app.core.production import validate_production_settings


def _prod_settings(**kwargs) -> Settings:
    base = dict(
        environment="production",
        jwt_secret="a" * 40,
        database_url="postgresql://u:p@db.example.com/neuroflow",
        frontend_url="https://app.example.com",
        platform_base_url="https://app.example.com",
        auth0_domain="tenant.eu.auth0.com",
        auth0_audience="https://neuroflow-api",
    )
    base.update(kwargs)
    return Settings(**base)


def test_production_rejects_sqlite():
    s = _prod_settings(database_url="sqlite:///./test.db")
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        validate_production_settings(s)


def test_production_rejects_missing_auth0():
    s = _prod_settings(auth0_domain="", auth0_audience="")
    with pytest.raises(RuntimeError, match="AUTH0"):
        validate_production_settings(s)


def test_production_accepts_valid_auth0_config():
    validate_production_settings(_prod_settings())


def test_development_allows_sqlite():
    s = Settings(environment="development", database_url="sqlite:///./test.db")
    validate_production_settings(s)
