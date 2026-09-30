"""Lightweight audit logging service."""

import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_event(
    db: Session,
    event_type: str,
    actor_user_id: str | None = None,
    actor_name: str | None = None,
    actor_email: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    target_name: str | None = None,
    detail: str | None = None,
) -> None:
    """Write one audit entry. Non-fatal: if the table is missing the caller's commit still succeeds."""
    try:
        entry = AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
            event_type=event_type,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
            actor_email=actor_email,
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            detail=detail,
        )
        db.add(entry)
        db.commit()
    except Exception:
        pass
