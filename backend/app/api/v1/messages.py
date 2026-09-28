"""Direct messaging between admin and clinical staff."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.message import DirectMessage, MessageList, MessageOut, MessageSend
from app.models.user import UserRecord

router = APIRouter()

ALLOWED_ROLES = {"clinical-admin", "super-platform-admin", "senior-clinician", "clinician"}


def _assert_messaging_role(user: UserRecord) -> None:
    if user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Messaging not available for your role")


@router.get("/inbox", response_model=MessageList)
def inbox(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> MessageList:
    _assert_messaging_role(user)
    msgs = (
        db.query(DirectMessage)
        .filter(DirectMessage.recipient_id == user.id)
        .order_by(DirectMessage.created_at.desc())
        .all()
    )
    unread = sum(1 for m in msgs if not m.is_read)
    return MessageList(items=[MessageOut.model_validate(m) for m in msgs], total=len(msgs), unread=unread)


@router.get("/sent", response_model=MessageList)
def sent(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> MessageList:
    _assert_messaging_role(user)
    msgs = (
        db.query(DirectMessage)
        .filter(DirectMessage.sender_id == user.id)
        .order_by(DirectMessage.created_at.desc())
        .all()
    )
    return MessageList(items=[MessageOut.model_validate(m) for m in msgs], total=len(msgs), unread=0)


@router.get("/unread-count", response_model=dict)
def unread_count(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> dict:
    count = (
        db.query(DirectMessage)
        .filter(DirectMessage.recipient_id == user.id, DirectMessage.is_read == False)  # noqa: E712
        .count()
    )
    return {"unread": count}


@router.get("/thread/{message_id}", response_model=MessageList)
def get_thread(
    message_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> MessageList:
    _assert_messaging_role(user)
    root = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if not root:
        raise HTTPException(status_code=404, detail="Message not found")
    root_id = root.parent_id or root.id
    msgs = (
        db.query(DirectMessage)
        .filter(
            (DirectMessage.id == root_id) |
            (DirectMessage.parent_id == root_id)
        )
        .order_by(DirectMessage.created_at.asc())
        .all()
    )
    return MessageList(items=[MessageOut.model_validate(m) for m in msgs], total=len(msgs), unread=0)


@router.post("/send", response_model=MessageOut, status_code=201)
def send_message(
    body: MessageSend,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> MessageOut:
    _assert_messaging_role(user)
    recipient = db.query(UserRecord).filter(UserRecord.id == body.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    import json
    msg = DirectMessage(
        id=f"MSG-{uuid.uuid4().hex[:8].upper()}",
        sender_id=user.id,
        sender_name=user.full_name,
        sender_role=user.role,
        recipient_id=recipient.id,
        recipient_name=recipient.full_name,
        subject=body.subject,
        body=body.body,
        parent_id=body.parent_id,
        is_read=False,
        attachment_urls=json.dumps(body.attachment_urls) if body.attachment_urls else None,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return MessageOut.model_validate(msg)


@router.patch("/{message_id}/read", response_model=dict)
def mark_read(
    message_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> dict:
    msg = db.query(DirectMessage).filter(
        DirectMessage.id == message_id,
        DirectMessage.recipient_id == user.id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = True
    db.commit()
    return {"ok": True}


@router.get("/users", response_model=list[dict])
def list_messageable_users(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[dict]:
    _assert_messaging_role(user)
    users = (
        db.query(UserRecord)
        .filter(UserRecord.role.in_(list(ALLOWED_ROLES)), UserRecord.is_active == True)  # noqa: E712
        .all()
    )
    return [
        {"id": u.id, "full_name": u.full_name, "role": u.role}
        for u in users if u.id != user.id
    ]
