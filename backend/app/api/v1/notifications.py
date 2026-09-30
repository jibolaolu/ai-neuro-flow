"""In-platform notifications for staff users."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.notification import NotificationOut, NotificationRecord
from app.models.user import UserRecord

router = APIRouter()


def create_notification(
    db: Session,
    *,
    user_id: str,
    type: str,
    title: str,
    body: str | None = None,
    client_id: str | None = None,
    link: str | None = None,
) -> NotificationRecord:
    n = NotificationRecord(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        client_id=client_id,
        link=link,
        read=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(n)
    return n


def fan_out_to_role(
    db: Session,
    *,
    role: str,
    type: str,
    title: str,
    body: str | None = None,
    client_id: str | None = None,
    link: str | None = None,
) -> list[NotificationRecord]:
    users = (
        db.query(UserRecord)
        .filter(UserRecord.role == role, UserRecord.is_active == True)  # noqa: E712
        .all()
    )
    records = []
    for u in users:
        n = create_notification(
            db,
            user_id=u.id,
            type=type,
            title=title,
            body=body,
            client_id=client_id,
            link=link,
        )
        records.append(n)
    return records


@router.get("", response_model=dict)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    items = (
        db.query(NotificationRecord)
        .filter(NotificationRecord.user_id == current_user.id)
        .order_by(NotificationRecord.created_at.desc())
        .limit(50)
        .all()
    )
    unread = sum(1 for n in items if not n.read)
    return {
        "items": [NotificationOut.model_validate(n) for n in items],
        "unread": unread,
    }


@router.patch("/{notification_id}/read", response_model=dict)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    n = (
        db.query(NotificationRecord)
        .filter(
            NotificationRecord.id == notification_id,
            NotificationRecord.user_id == current_user.id,
        )
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/mark-all-read", response_model=dict)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    db.query(NotificationRecord).filter(
        NotificationRecord.user_id == current_user.id,
        NotificationRecord.read == False,  # noqa: E712
    ).update({"read": True})
    db.commit()
    return {"ok": True}


@router.get("/unread-count", response_model=dict)
def unread_count(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> dict:
    count = (
        db.query(NotificationRecord)
        .filter(
            NotificationRecord.user_id == current_user.id,
            NotificationRecord.read == False,  # noqa: E712
        )
        .count()
    )
    return {"unread": count}
