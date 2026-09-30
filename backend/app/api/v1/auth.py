from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.auth0 import auth0_enabled
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.models.user import LoginRequest, LoginResponse, UserOut, UserRecord

router = APIRouter()

# Role → frontend path mapping
ROLE_PATHS: dict[str, str] = {
    "super-platform-admin": "/super-admin",
    "clinical-admin": "/clinic-admin",
    "senior-clinician": "/senior-clinician",
    "clinician": "/clinician",
}


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    """Local email/password login — development only when Auth0 is not enforced."""
    if settings.is_production() and auth0_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    user = db.query(UserRecord).filter(UserRecord.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    extra = {"clinic_id": user.clinic_id} if user.clinic_id else None
    token = create_access_token(subject=user.id, role=user.role, extra=extra)
    return LoginResponse(
        access_token=token,
        role=user.role,
        full_name=user.full_name,
        redirect_path=ROLE_PATHS.get(user.role, "/"),
    )


@router.get("/me", response_model=UserOut)
def get_me(user: UserRecord = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
