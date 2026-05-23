"""
Support ticket endpoints.

Lifecycle:  open → in_progress → awaiting_info → resolved → closed

Permissions:
  - Any authenticated role: POST (raise a ticket), GET own clinic tickets
  - super-platform-admin / platform-admin: GET all, PATCH (update status, respond, assign)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.support_ticket import (
    TICKET_STATUS_CLOSED,
    TICKET_STATUS_RESOLVED,
    SupportTicketCreate,
    SupportTicketList,
    SupportTicketOut,
    SupportTicketRecord,
    SupportTicketUpdate,
)
from app.models.user import UserRecord
from app.services.tenant import effective_clinic_id, is_platform_admin

router = APIRouter(redirect_slashes=False)

_ALL_ROLES = (
    "super-platform-admin",
    "platform-admin",
    "clinical-admin",
    "clinic-admin",
    "clinician",
    "senior-clinician",
    "admin",
)


def _ticket_id() -> str:
    return f"TKT-{uuid.uuid4().hex[:8].upper()}"


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=SupportTicketList)
def list_tickets(
    status_filter: str | None = None,
    priority: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    q = db.query(SupportTicketRecord)

    if is_platform_admin(user):
        # Platform team sees all tickets across all clinics
        pass
    else:
        # Clinic users see only their own clinic's tickets
        cid = effective_clinic_id(user)
        if cid:
            q = q.filter(SupportTicketRecord.clinic_id == cid)
        else:
            # If no clinic_id, show only own tickets
            q = q.filter(SupportTicketRecord.raised_by_user_id == user.id)

    if status_filter:
        q = q.filter(SupportTicketRecord.status == status_filter)
    if priority:
        q = q.filter(SupportTicketRecord.priority == priority)

    q = q.order_by(SupportTicketRecord.created_at.desc())
    rows = q.all()
    return SupportTicketList(items=rows, total=len(rows))


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    cid = effective_clinic_id(user)

    # Attempt to get clinic name from org
    clinic_name: str | None = None
    if cid:
        try:
            from app.models.organization import OrganizationRecord
            org = db.query(OrganizationRecord).filter(OrganizationRecord.id == cid).first()
            if org:
                clinic_name = getattr(org, "name", None) or getattr(org, "clinic_name", None)
        except Exception:
            pass

    ticket = SupportTicketRecord(
        id=_ticket_id(),
        raised_by_user_id=user.id,
        raised_by_name=getattr(user, "full_name", None) or getattr(user, "name", None) or user.email,
        raised_by_email=user.email,
        clinic_id=cid,
        clinic_name=clinic_name,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


# ── Single ────────────────────────────────────────────────────────────────────

@router.get("/{ticket_id}", response_model=SupportTicketOut)
def get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    ticket = db.query(SupportTicketRecord).filter(SupportTicketRecord.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access control — platform admins can read all; others only their clinic
    if not is_platform_admin(user):
        cid = effective_clinic_id(user)
        if ticket.clinic_id != cid and ticket.raised_by_user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return ticket


# ── Update (platform admin only) ──────────────────────────────────────────────

@router.patch("/{ticket_id}", response_model=SupportTicketOut)
def update_ticket(
    ticket_id: str,
    payload: SupportTicketUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
):
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Platform admin access required")

    ticket = db.query(SupportTicketRecord).filter(SupportTicketRecord.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if payload.status is not None:
        ticket.status = payload.status
        if payload.status in (TICKET_STATUS_RESOLVED, TICKET_STATUS_CLOSED):
            ticket.resolved_at = datetime.now(timezone.utc)
    if payload.assigned_to_user_id is not None:
        ticket.assigned_to_user_id = payload.assigned_to_user_id
    if payload.assigned_to_name is not None:
        ticket.assigned_to_name = payload.assigned_to_name
    if payload.platform_response is not None:
        ticket.platform_response = payload.platform_response
    if payload.priority is not None:
        ticket.priority = payload.priority

    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    return ticket
