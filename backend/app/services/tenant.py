"""
Row-level tenant isolation for shared-database multi-tenancy.

Every tenant-owned row carries clinic_id (organization id). All queries
filter by the authenticated user's clinic_id; super-platform-admin bypasses.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Query, Session

from app.models.client import ClientRecord
from app.models.organization import (
    SUB_ACTIVE,
    SUB_CANCELED,
    SUB_PAST_DUE,
    SUB_TRIALING,
    OrganizationRecord,
)
from app.models.user import UserRecord

PLATFORM_ADMIN_ROLE = "super-platform-admin"


def is_platform_admin(user: UserRecord) -> bool:
    return user.role == PLATFORM_ADMIN_ROLE


def effective_clinic_id(user: UserRecord) -> str | None:
    """Organization id for tenant scoping; None only for platform admin."""
    if is_platform_admin(user):
        return None
    return user.clinic_id


def require_clinic_member(user: UserRecord) -> str:
    cid = effective_clinic_id(user)
    if not cid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must impersonate or select a clinic context",
        )
    return cid


def get_organization(db: Session, clinic_id: str) -> OrganizationRecord | None:
    return db.query(OrganizationRecord).filter(OrganizationRecord.id == clinic_id).first()


def organization_allows_access(org: OrganizationRecord) -> bool:
    if not org.is_active:
        return False
    if org.subscription_status in (SUB_ACTIVE, SUB_TRIALING):
        if org.subscription_status == SUB_TRIALING and org.trial_ends_at:
            return org.trial_ends_at.replace(tzinfo=timezone.utc) >= datetime.now(timezone.utc)
        return True
    if org.subscription_status == SUB_PAST_DUE:
        return True  # grace: read-only could be enforced later
    return False


def require_active_subscription(db: Session, user: UserRecord) -> OrganizationRecord:
    if is_platform_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not applicable for platform admin",
        )
    cid = require_clinic_member(user)
    org = get_organization(db, cid)
    if not org:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization not found")
    if not organization_allows_access(org):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Subscription inactive or trial expired. Renew your Neuro Flow plan.",
        )
    return org


def clients_query(db: Session, user: UserRecord) -> Query:
    q = db.query(ClientRecord)
    cid = effective_clinic_id(user)
    if cid is not None:
        q = q.filter(ClientRecord.clinic_id == cid)
    return q


def get_client_for_user(db: Session, user: UserRecord, client_id: str) -> ClientRecord:
    record = clients_query(db, user).filter(ClientRecord.id == client_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return record


def assert_client_tenant(record: ClientRecord, user: UserRecord) -> None:
    cid = effective_clinic_id(user)
    if cid is not None and record.clinic_id != cid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")


def assert_user_in_tenant(actor: UserRecord, target: UserRecord) -> None:
    if is_platform_admin(actor):
        return
    if actor.clinic_id != target.clinic_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not in your organization")
