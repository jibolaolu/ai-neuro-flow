"""Admin audit log endpoint — returns recent platform events."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.audit_log import AuditLog, AuditLogList, AuditLogOut
from app.models.user import UserRecord

router = APIRouter()


@router.get("/", response_model=AuditLogList)
def list_audit_log(
    limit: int = Query(default=200, ge=1, le=500),
    event_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> AuditLogList:
    query = db.query(AuditLog)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if target_id:
        query = query.filter(AuditLog.target_id == target_id)
    rows = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    items = [
        AuditLogOut(
            id=r.id,
            event_type=r.event_type,
            actor_user_id=r.actor_user_id,
            actor_name=r.actor_name,
            actor_email=r.actor_email,
            target_type=r.target_type,
            target_id=r.target_id,
            target_name=r.target_name,
            detail=r.detail,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
    return AuditLogList(items=items, total=len(items))
