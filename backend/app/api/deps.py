from collections.abc import Callable, Generator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.auth0 import email_from_claims
from app.core.config import settings
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


def require_roles(*allowed: str) -> Callable:
    def _inner(user: UserRecord = Depends(get_current_user)) -> UserRecord:
        if user.role in allowed:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return _inner
