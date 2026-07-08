"""
AI Job management endpoints.

Clinicians can enqueue jobs and poll their status.
Platform/clinic admins can see all jobs for their clinic.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.ai_job import (
    AIJobCreate,
    AIJobList,
    AIJobOut,
    AIJobRecord,
    JOB_STATUS_QUEUED,
)
from app.models.user import UserRecord
from app.services.ai_workers import enqueue_job
from app.services.tenant import effective_clinic_id, is_platform_admin

router = APIRouter(redirect_slashes=False)


@router.get("", response_model=AIJobList)
def list_jobs(
    worker_type: str | None = None,
    job_status:  str | None = None,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    q = db.query(AIJobRecord)

    if is_platform_admin(user):
        pass  # see all
    else:
        cid = effective_clinic_id(user)
        if cid:
            q = q.filter(AIJobRecord.clinic_id == cid)
        else:
            q = q.filter(AIJobRecord.created_by == user.id)

    if worker_type:
        q = q.filter(AIJobRecord.worker_type == worker_type)
    if job_status:
        q = q.filter(AIJobRecord.status == job_status)

    rows = q.order_by(AIJobRecord.created_at.desc()).limit(100).all()
    return AIJobList(items=rows, total=len(rows))


@router.post("", response_model=AIJobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: AIJobCreate,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    job = enqueue_job(
        worker_type=payload.worker_type,
        payload={**payload.payload, "clinic_id": cid or ""},
        clinic_id=cid,
        created_by=user.id,
        db=db,
    )
    return job


@router.get("/{job_id}", response_model=AIJobOut)
def get_job(
    job_id: str,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    job = db.query(AIJobRecord).filter(AIJobRecord.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    # Access check
    if not is_platform_admin(user):
        cid = effective_clinic_id(user)
        if job.clinic_id != cid and job.created_by != user.id:
            raise HTTPException(403, "Access denied")

    return job


@router.delete("/{job_id}", status_code=204)
def cancel_job(
    job_id: str,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    job = db.query(AIJobRecord).filter(AIJobRecord.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != JOB_STATUS_QUEUED:
        raise HTTPException(400, "Only queued jobs can be cancelled")

    cid = effective_clinic_id(user)
    if not is_platform_admin(user) and job.clinic_id != cid and job.created_by != user.id:
        raise HTTPException(403, "Access denied")

    db.delete(job)
    db.commit()
