import uuid
from collections.abc import Callable, Generator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.auth0 import email_from_claims
from app.core.config import settings
from app.core.security import hash_password
from app.core.token_decode import decode_token
from app.db.session import SessionLocal
from app.models.user import UserRecord
from app.services.tenant import get_organization, is_platform_admin, organization_allows_access

security = HTTPBearer(auto_error=False)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_bearer_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    for name in (settings.auth_cookie_name, settings.legacy_auth_cookie_name):
        cookie = request.cookies.get(name)
        if cookie:
            return cookie
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
) -> UserRecord:
    try:
        claims, source = decode_token(token)
        if source == "auth0":
            email = email_from_claims(claims)
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Auth0 token missing email claim — enable email scope on your API",
                )
            user = db.query(UserRecord).filter(UserRecord.email == email).first()
            if not user:
                user = _provision_auth0_user(db, email, claims)
        else:
            user_id = claims["sub"]
            user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    except (JWTError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive",
        )
    if not is_platform_admin(user) and user.clinic_id:
        org = get_organization(db, user.clinic_id)
        if org and not organization_allows_access(org):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Organization subscription inactive or trial expired",
            )
    return user


def _provision_auth0_user(db: Session, email: str, claims: dict) -> UserRecord:
    """
    First-time Auth0 login: create a NeuroFlow UserRecord from verified Auth0 claims.
    Role is pulled from a custom Auth0 claim (any claim ending in /role or /roles),
    falling back to clinical-admin so the user lands in the clinic-admin dashboard.
    Password is set to a random unusable value — login is Auth0-only for these accounts.
    """
    name = (
        claims.get("name")
        or f"{claims.get('given_name', '')} {claims.get('family_name', '')}".strip()
        or claims.get("nickname")
        or email.split("@")[0]
    )

    role = "clinical-admin"
    for key, value in claims.items():
        if key.endswith("/role") and isinstance(value, str) and value.strip():
            role = value.strip()
            break
        if key.endswith("/roles") and isinstance(value, list) and value:
            role = str(value[0]).strip()
            break
    if not role and isinstance(claims.get("roles"), list) and claims["roles"]:
        role = str(claims["roles"][0]).strip()

    user = UserRecord(
        id=str(uuid.uuid4()),
        email=email,
        full_name=name or email,
        hashed_password=hash_password(str(uuid.uuid4())),  # random — Auth0 login only
        role=role,
        is_active=True,
        clinic_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def require_roles(*allowed: str) -> Callable:
    def _inner(user: UserRecord = Depends(get_current_user)) -> UserRecord:
        if user.role in allowed:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return _inner
