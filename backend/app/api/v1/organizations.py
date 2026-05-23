"""Organization signup, profile, and team invites."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.auth0 import auth0_enabled
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.organization import (
    InviteClinicianBody,
    OrganizationOut,
    OrganizationRecord,
    OrganizationSignup,
    SUB_TRIALING,
)
from app.models.user import UserOut, UserRecord
from app.services.tenant import assert_user_in_tenant, get_organization, require_clinic_member

router = APIRouter()


def _org_id() -> str:
    return f"ORG-{uuid.uuid4().hex[:8].upper()}"


def _normalize_slug(slug: str) -> str:
    s = slug.strip().lower()
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", s):
        raise HTTPException(status_code=400, detail="Invalid slug format")
    return s


@router.post("/signup", response_model=dict, status_code=status.HTTP_201_CREATED)
def signup_organization(payload: OrganizationSignup, db: Session = Depends(get_db)) -> dict:
    """Register a new clinic (organization) and its first clinical admin."""
    if not settings.allow_public_signup:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is disabled. Contact sales for an invite.",
        )
    slug = _normalize_slug(payload.slug)
    if db.query(OrganizationRecord).filter(OrganizationRecord.slug == slug).first():
        raise HTTPException(status_code=409, detail="Organization slug already taken")
    email = str(payload.admin_email).strip().lower()
    if db.query(UserRecord).filter(UserRecord.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    org_id = _org_id()
    trial_end = datetime.now(timezone.utc) + timedelta(days=settings.signup_trial_days)
    org = OrganizationRecord(
        id=org_id,
        name=payload.organization_name.strip(),
        slug=slug,
        subscription_status=SUB_TRIALING,
        subscription_plan=None,
        trial_ends_at=trial_end,
    )
    admin = UserRecord(
        id=str(uuid.uuid4()),
        email=email,
        full_name=payload.admin_full_name.strip(),
        hashed_password=hash_password(payload.admin_password),
        role="clinical-admin",
        is_active=True,
        clinic_id=org_id,
    )
    db.add(org)
    db.add(admin)
    db.commit()

    org_out = OrganizationOut.model_validate(org).model_dump()
    # Production uses Auth0 login — user must exist in Auth0 with the same email (setup-auth0.js or invite).
    if settings.is_production() and auth0_enabled():
        return {
            "organization": org_out,
            "auth0_login_required": True,
            "role": admin.role,
            "full_name": admin.full_name,
            "redirect_path": "/login",
        }

    token = create_access_token(
        subject=admin.id,
        role=admin.role,
        extra={"clinic_id": org_id},
    )
    return {
        "organization": org_out,
        "access_token": token,
        "token_type": "Bearer",
        "role": admin.role,
        "full_name": admin.full_name,
        "redirect_path": "/clinic-admin",
    }


@router.get("/me", response_model=OrganizationOut)
def get_my_organization(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "senior-clinician", "clinician")),
) -> OrganizationOut:
    cid = require_clinic_member(user)
    org = get_organization(db, cid)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationOut.model_validate(org)


@router.post("/invite", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def invite_clinician(
    body: InviteClinicianBody,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin")),
) -> UserOut:
    """Clinical admin adds a clinician to their organization."""
    cid = require_clinic_member(actor)
    email = str(body.email).strip().lower()
    if db.query(UserRecord).filter(UserRecord.email == email).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    user = UserRecord(
        id=str(uuid.uuid4()),
        email=email,
        full_name=body.full_name.strip(),
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
        clinic_id=cid,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/team", response_model=dict)
def list_organization_team(
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin")),
) -> dict:
    cid = require_clinic_member(actor)
    users = (
        db.query(UserRecord)
        .filter(UserRecord.clinic_id == cid)
        .order_by(UserRecord.full_name)
        .all()
    )
    return {
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
            }
            for u in users
        ]
    }
