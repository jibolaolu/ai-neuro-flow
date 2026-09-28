"""Client-to-clinic quick messaging."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.client import ClientRecord
from app.models.client_portal_message import (
    ClientPortalMessage,
    ClientPortalMessageList,
    ClientPortalMessageOut,
    ClientPortalMessageSend,
)
from app.models.user import UserRecord

router = APIRouter()
public_router = APIRouter()
_log = logging.getLogger(__name__)

_STAFF_ROLES = ("clinical-admin", "super-platform-admin", "clinician", "senior-clinician")


def _get_client_by_token(token: str, db: Session, request: Request | None = None) -> ClientRecord:
    if request:
        session_val = request.cookies.get("portal_session")
        if session_val:
            c = db.query(ClientRecord).filter(ClientRecord.portal_session_token == session_val).first()
            client = c if c else None
        else:
            client = None
        if client is None:
            client = db.query(ClientRecord).filter(ClientRecord.booking_access_token == token).first()
    else:
        client = db.query(ClientRecord).filter(ClientRecord.booking_access_token == token).first()
    if not client:
        raise HTTPException(status_code=404, detail="Invalid or expired portal token")
    return client


def _msgs_out(msgs: list[ClientPortalMessage]) -> ClientPortalMessageList:
    items = [ClientPortalMessageOut.model_validate(m) for m in msgs]
    unread = sum(1 for m in msgs if not m.is_read)
    return ClientPortalMessageList(items=items, total=len(items), unread=unread)


@public_router.get("/client-comms/{token}/messages", response_model=ClientPortalMessageList)
def client_list_messages(token: str, request: Request, db: Session = Depends(get_db)) -> ClientPortalMessageList:
    client = _get_client_by_token(token, db, request)
    msgs = (
        db.query(ClientPortalMessage)
        .filter(ClientPortalMessage.client_id == client.id)
        .order_by(ClientPortalMessage.created_at.asc())
        .all()
    )
    for m in msgs:
        if m.direction == "clinic_to_client" and not m.is_read:
            m.is_read = True
    db.commit()
    return _msgs_out(msgs)


@public_router.post("/client-comms/{token}/messages", response_model=ClientPortalMessageOut, status_code=201)
def client_send_message(
    token: str,
    body: ClientPortalMessageSend,
    request: Request,
    db: Session = Depends(get_db),
) -> ClientPortalMessageOut:
    client = _get_client_by_token(token, db, request)
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg = ClientPortalMessage(
        client_id=client.id,
        direction="client_to_clinic",
        sender_name=client.full_name,
        body=body.body.strip()[:2000],
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return ClientPortalMessageOut.model_validate(msg)


@router.get("/{client_id}/messages", response_model=ClientPortalMessageList)
def staff_list_messages(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> ClientPortalMessageList:
    if user.role not in _STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")
    msgs = (
        db.query(ClientPortalMessage)
        .filter(ClientPortalMessage.client_id == client_id)
        .order_by(ClientPortalMessage.created_at.asc())
        .all()
    )
    for m in msgs:
        if m.direction == "client_to_clinic" and not m.is_read:
            m.is_read = True
    db.commit()
    return _msgs_out(msgs)


@router.post("/{client_id}/messages", response_model=ClientPortalMessageOut, status_code=201)
def staff_send_message(
    client_id: str,
    body: ClientPortalMessageSend,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> ClientPortalMessageOut:
    if user.role not in _STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg = ClientPortalMessage(
        client_id=client_id,
        direction="clinic_to_client",
        sender_name=user.full_name,
        sender_user_id=user.id,
        body=body.body.strip()[:2000],
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return ClientPortalMessageOut.model_validate(msg)
