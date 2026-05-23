"""Clinician-facing assessment queue from live client / assignment data."""

from datetime import date as date_cls
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.user import UserRecord
from app.services.tenant import clients_query

router = APIRouter()


@router.get("/mine", response_model=dict)
def my_assignments(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
    date_from: str | None = Query(None, description="Filter by registration date (YYYY-MM-DD), start inclusive (UTC)"),
    date_to: str | None = Query(None, description="Filter by registration date (YYYY-MM-DD), end inclusive (UTC)"),
    status: str | None = Query(None, description="Case-insensitive substring match on client.status"),
) -> dict:
    q = clients_query(db, user).filter(ClientRecord.assigned_clinician_user_id == user.id)

    if status and status.strip():
        q = q.filter(ClientRecord.status.ilike(f"%{status.strip()}%"))

    if date_from:
        df = date_cls.fromisoformat(date_from)
        start = datetime(df.year, df.month, df.day, tzinfo=timezone.utc)
        q = q.filter(ClientRecord.created_at >= start)
    if date_to:
        dt = date_cls.fromisoformat(date_to)
        end = datetime(dt.year, dt.month, dt.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
        q = q.filter(ClientRecord.created_at <= end)

    rows = q.order_by(ClientRecord.created_at.desc()).all()
    return {
        "items": [
            {
                "client_id": r.id,
                "full_name": r.full_name,
                "pathway": r.pathway,
                "status": r.status,
                "stage": r.stage,
                "assessment_id": r.assessment_id,
                "registered_at": r.created_at,
                "confirmed_session_at": r.confirmed_session_at,
                "report_due_at": r.report_due_at,
            }
            for r in rows
        ],
        "total": len(rows),
    }
