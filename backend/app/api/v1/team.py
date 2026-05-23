from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.security import hash_password
from app.models.user import UserRecord

router = APIRouter()


def _clinician_response(u: UserRecord) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "clinic_id": u.clinic_id,
        "phone": u.phone,
        "address_line": u.address_line,
        "date_of_birth": u.date_of_birth,
    }


def _assert_can_manage_clinician(actor: UserRecord, target: UserRecord) -> None:
    if target.role not in ("clinician", "senior-clinician"):
        raise HTTPException(status_code=404, detail="Clinician not found")
    if actor.role == "super-platform-admin":
        return
    if actor.role == "clinical-admin":
        if actor.clinic_id != target.clinic_id:
            raise HTTPException(
                status_code=403,
                detail="You can only manage clinicians in your clinic",
            )
        return
    raise HTTPException(status_code=403, detail="Insufficient permissions")


def _get_clinician_or_404(db: Session, user_id: str) -> UserRecord:
    u = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    if not u or u.role not in ("clinician", "senior-clinician"):
        raise HTTPException(status_code=404, detail="Clinician not found")
    return u


@router.get("/clinicians", response_model=dict)
def list_clinicians_for_assignment(
    include_inactive: bool = Query(False, description="Team roster: include deactivated clinicians"),
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """List clinicians; default active-only (assignment dropdown). Pass include_inactive for full roster."""
    q = db.query(UserRecord).filter(UserRecord.role.in_(("clinician", "senior-clinician")))
    if actor.role == "clinical-admin":
        q = q.filter(UserRecord.clinic_id == actor.clinic_id)
    if not include_inactive:
        q = q.filter(UserRecord.is_active == True)  # noqa: E712
    users = q.order_by(UserRecord.is_active.desc(), UserRecord.full_name).all()
    return {"items": [_clinician_response(u) for u in users]}


@router.get("/clinicians/{user_id}", response_model=dict)
def get_clinician_for_admin(
    user_id: str,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Single clinician profile for admin team detail (active or inactive)."""
    u = _get_clinician_or_404(db, user_id)
    _assert_can_manage_clinician(actor, u)
    return _clinician_response(u)


class ClinicianAdminUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=200)
    email: EmailStr | None = None
    role: Literal["clinician", "senior-clinician"] | None = None
    password: str | None = Field(None, min_length=8, max_length=128)
    is_active: bool | None = None
    phone: str | None = Field(None, max_length=80)
    address_line: str | None = Field(None, max_length=500)
    date_of_birth: str | None = Field(None, max_length=32, description="YYYY-MM-DD")


@router.patch("/clinicians/{user_id}", response_model=dict)
def update_clinician_for_admin(
    user_id: str,
    body: ClinicianAdminUpdate,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    u = _get_clinician_or_404(db, user_id)
    _assert_can_manage_clinician(actor, u)

    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "email" in data:
        other = (
            db.query(UserRecord)
            .filter(UserRecord.email == str(data["email"]), UserRecord.id != u.id)
            .first()
        )
        if other:
            raise HTTPException(status_code=409, detail="Email already in use")

    if "full_name" in data:
        u.full_name = data["full_name"].strip()
    if "email" in data:
        u.email = str(data["email"]).strip().lower()
    if "role" in data:
        u.role = data["role"]
    if "password" in data:
        u.hashed_password = hash_password(data["password"])
    if "is_active" in data:
        u.is_active = data["is_active"]
    if "phone" in data:
        u.phone = (data["phone"] or "").strip() or None
    if "address_line" in data:
        u.address_line = (data["address_line"] or "").strip() or None
    if "date_of_birth" in data:
        u.date_of_birth = (data["date_of_birth"] or "").strip() or None

    db.commit()
    db.refresh(u)
    return _clinician_response(u)


@router.delete("/clinicians/{user_id}", response_model=dict)
def deactivate_clinician_for_admin(
    user_id: str,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Soft-delete: deactivate account (blocks login and API). Admin can reactivate via PATCH."""
    u = _get_clinician_or_404(db, user_id)
    _assert_can_manage_clinician(actor, u)
    u.is_active = False
    db.commit()
    db.refresh(u)
    return _clinician_response(u)
