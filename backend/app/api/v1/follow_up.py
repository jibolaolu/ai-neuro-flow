"""
Post-assessment follow-up form scheduling.
Dispatches questionnaires at 3, 6, and 12 months post-assessment.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.follow_up_schedule import (
    FollowUpScheduleCreate,
    FollowUpScheduleList,
    FollowUpScheduleOut,
    FollowUpScheduleRecord,
    FOLLOWUP_STATUS_PENDING,
)
from app.models.user import UserRecord
from app.services.tenant import effective_clinic_id, get_client_for_user

router = APIRouter(redirect_slashes=False)

_CLINICAL_ROLES = ("clinician", "senior-clinician", "clinical-admin", "clinic-admin")


def _fup_id() -> str:
    return f"FUP-{uuid.uuid4().hex[:8].upper()}"


@router.post("/{client_id}", response_model=list[FollowUpScheduleOut], status_code=status.HTTP_201_CREATED)
def schedule_follow_up(
    client_id: str,
    payload:   FollowUpScheduleCreate,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """
    Schedule post-assessment follow-up forms for a client.
    Defaults to 3, 6, and 12-month checkpoints from today.
    Idempotent per (client_id, months_offset) — won't duplicate.
    """
    client    = get_client_for_user(db, user, client_id)
    clinic_id = effective_clinic_id(user)
    now       = datetime.now(timezone.utc)

    # Validate months
    valid = {3, 6, 12}
    requested = set(payload.months_offsets)
    invalid = requested - valid
    if invalid:
        raise HTTPException(400, f"Invalid month offsets: {invalid}. Must be 3, 6, or 12.")

    # Avoid duplicates
    existing = {
        r.months_offset for r in
        db.query(FollowUpScheduleRecord).filter(
            FollowUpScheduleRecord.client_id == client_id,
            FollowUpScheduleRecord.status == FOLLOWUP_STATUS_PENDING,
        ).all()
    }

    created = []
    for months in sorted(requested):
        if months in existing:
            continue
        rec = FollowUpScheduleRecord(
            id             = _fup_id(),
            client_id      = client_id,
            clinic_id      = clinic_id,
            assessment_id  = client.assessment_id,
            recipient_email = client.email,
            client_name    = client.full_name,
            months_offset  = months,
            due_at         = now + timedelta(days=months * 30),
            created_by     = user.id,
        )
        db.add(rec)
        created.append(rec)

    db.commit()
    for r in created:
        db.refresh(r)
    return created


@router.get("/{client_id}", response_model=FollowUpScheduleList)
def list_follow_ups(
    client_id: str,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """List follow-up schedules for a client."""
    get_client_for_user(db, user, client_id)
    rows = (
        db.query(FollowUpScheduleRecord)
        .filter(FollowUpScheduleRecord.client_id == client_id)
        .order_by(FollowUpScheduleRecord.due_at)
        .all()
    )
    return FollowUpScheduleList(items=rows, total=len(rows))
