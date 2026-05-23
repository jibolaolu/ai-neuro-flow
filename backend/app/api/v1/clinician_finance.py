"""Timesheets, invoice requests, PDF export, and admin approval."""

from datetime import date, datetime, timezone
from typing import Literal
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.clinician_finance import InvoiceRequestRecord, TimesheetLineRecord
from app.models.user import UserRecord
from app.services.invoice_pdf import build_invoice_request_pdf

router = APIRouter()

_ADMIN_ROLES = ("clinical-admin", "super-platform-admin")


class TimesheetCreate(BaseModel):
    activity_date: date
    hours: float = Field(gt=0, le=80)
    description: str = Field(min_length=1, max_length=500)
    client_ref: str | None = Field(None, max_length=200)


class TimesheetOut(BaseModel):
    id: str
    activity_date: date
    hours: float
    description: str
    client_ref: str | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceGenerateIn(BaseModel):
    period_from: date
    period_to: date
    notes: str | None = Field(None, max_length=2000)


class InvoiceGenerateOut(BaseModel):
    id: str
    period_from: date
    period_to: date
    total_hours: float
    line_count: int
    notes: str | None
    created_at: datetime
    approval_status: str


class InvoiceSummaryOut(BaseModel):
    id: str
    period_from: date
    period_to: date
    total_hours: float | None
    line_count: int | None
    notes: str | None
    status: str
    created_at: datetime
    approval_status: str
    reviewed_at: datetime | None
    review_notes: str | None

    class Config:
        from_attributes = True


class InvoiceRequestAdminOut(BaseModel):
    id: str
    user_id: str
    clinician_full_name: str
    period_from: date
    period_to: date
    total_hours: float | None
    line_count: int | None
    notes: str | None
    status: str
    created_at: datetime
    approval_status: str
    reviewed_at: datetime | None
    review_notes: str | None
    reviewed_by_user_id: str | None

    class Config:
        from_attributes = True


class InvoiceApprovalPatch(BaseModel):
    action: Literal["approve", "reject", "needs_revision"]
    notes: str | None = Field(None, max_length=2000)


def _lines_for_invoice(db: Session, user_id: str, period_from: date, period_to: date) -> list[TimesheetLineRecord]:
    return (
        db.query(TimesheetLineRecord)
        .filter(
            TimesheetLineRecord.user_id == user_id,
            TimesheetLineRecord.status == "submitted",
            TimesheetLineRecord.activity_date >= period_from,
            TimesheetLineRecord.activity_date <= period_to,
        )
        .order_by(TimesheetLineRecord.activity_date, TimesheetLineRecord.id)
        .all()
    )


@router.get("/timesheets/mine", response_model=dict[str, list[TimesheetOut]])
def list_my_timesheets(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> dict[str, list[TimesheetOut]]:
    rows = (
        db.query(TimesheetLineRecord)
        .filter(TimesheetLineRecord.user_id == user.id)
        .order_by(TimesheetLineRecord.activity_date.desc(), TimesheetLineRecord.created_at.desc())
        .limit(500)
        .all()
    )
    return {"items": [TimesheetOut.model_validate(r) for r in rows]}


@router.post("/timesheets", response_model=TimesheetOut)
def create_timesheet(
    body: TimesheetCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> TimesheetOut:
    rec = TimesheetLineRecord(
        id=str(uuid.uuid4()),
        user_id=user.id,
        activity_date=body.activity_date,
        hours=body.hours,
        description=body.description.strip(),
        client_ref=(body.client_ref.strip() if body.client_ref else None),
        status="submitted",
        created_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return TimesheetOut.model_validate(rec)


@router.post("/invoices/generate", response_model=InvoiceGenerateOut)
def generate_invoice(
    body: InvoiceGenerateIn,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> InvoiceGenerateOut:
    if body.period_to < body.period_from:
        raise HTTPException(status_code=400, detail="period_to must be on or after period_from")

    lines = _lines_for_invoice(db, user.id, body.period_from, body.period_to)
    total_hours = sum(r.hours for r in lines) if lines else 0.0
    inv = InvoiceRequestRecord(
        id=str(uuid.uuid4()),
        user_id=user.id,
        period_from=body.period_from,
        period_to=body.period_to,
        notes=body.notes.strip() if body.notes else None,
        status="generated",
        total_hours=total_hours,
        line_count=len(lines),
        created_at=datetime.now(timezone.utc),
        approval_status="pending",
        reviewed_by_user_id=None,
        reviewed_at=None,
        review_notes=None,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return InvoiceGenerateOut(
        id=inv.id,
        period_from=inv.period_from,
        period_to=inv.period_to,
        total_hours=total_hours,
        line_count=len(lines),
        notes=inv.notes,
        created_at=inv.created_at,
        approval_status=inv.approval_status,
    )


@router.get("/invoices/mine", response_model=dict[str, list[InvoiceSummaryOut]])
def list_my_invoices(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> dict[str, list[InvoiceSummaryOut]]:
    rows = (
        db.query(InvoiceRequestRecord)
        .filter(InvoiceRequestRecord.user_id == user.id)
        .order_by(InvoiceRequestRecord.created_at.desc())
        .limit(200)
        .all()
    )
    return {"items": [InvoiceSummaryOut.model_validate(r) for r in rows]}


def _pdf_watermark(inv: InvoiceRequestRecord) -> str | None:
    if inv.approval_status == "approved":
        return None
    labels = {
        "pending": "DRAFT - pending Clinical Admin approval",
        "rejected": "DRAFT - rejected (see notes in Neuro Flow)",
        "needs_revision": "DRAFT - revision requested",
    }
    return labels.get(inv.approval_status, "DRAFT")


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> Response:
    inv = db.query(InvoiceRequestRecord).filter(InvoiceRequestRecord.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if user.role not in _ADMIN_ROLES:
        if user.id != inv.user_id or user.role not in ("clinician", "senior-clinician"):
            raise HTTPException(status_code=403, detail="Not allowed")

    clinician = db.query(UserRecord).filter(UserRecord.id == inv.user_id).first()
    clinician_name = clinician.full_name if clinician else inv.user_id
    lines = _lines_for_invoice(db, inv.user_id, inv.period_from, inv.period_to)

    pdf_bytes = build_invoice_request_pdf(
        inv,
        clinician_name,
        lines,
        watermark=_pdf_watermark(inv),
    )
    filename = f"neuroflow-invoice-{inv.id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/admin/invoice-requests", response_model=dict[str, list[InvoiceRequestAdminOut]])
def admin_list_invoice_requests(
    approval_status: str | None = None,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> dict[str, list[InvoiceRequestAdminOut]]:
    q = (
        db.query(InvoiceRequestRecord, UserRecord.full_name)
        .join(UserRecord, InvoiceRequestRecord.user_id == UserRecord.id)
        .order_by(InvoiceRequestRecord.created_at.desc())
    )
    if approval_status and approval_status != "all":
        q = q.filter(InvoiceRequestRecord.approval_status == approval_status)
    rows = q.limit(500).all()
    items: list[InvoiceRequestAdminOut] = []
    for inv, full_name in rows:
        items.append(
            InvoiceRequestAdminOut(
                id=inv.id,
                user_id=inv.user_id,
                clinician_full_name=full_name,
                period_from=inv.period_from,
                period_to=inv.period_to,
                total_hours=inv.total_hours,
                line_count=inv.line_count,
                notes=inv.notes,
                status=inv.status,
                created_at=inv.created_at,
                approval_status=inv.approval_status,
                reviewed_at=inv.reviewed_at,
                review_notes=inv.review_notes,
                reviewed_by_user_id=inv.reviewed_by_user_id,
            )
        )
    return {"items": items}


@router.patch("/admin/invoice-requests/{invoice_id}", response_model=InvoiceRequestAdminOut)
def admin_patch_invoice_request(
    invoice_id: str,
    body: InvoiceApprovalPatch,
    db: Session = Depends(get_db),
    admin: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> InvoiceRequestAdminOut:
    inv = db.query(InvoiceRequestRecord).filter(InvoiceRequestRecord.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    notes_stripped = body.notes.strip() if body.notes else ""
    if body.action in ("reject", "needs_revision") and not notes_stripped:
        raise HTTPException(status_code=400, detail="notes required for reject or needs_revision")

    now = datetime.now(timezone.utc)
    if body.action == "approve":
        inv.approval_status = "approved"
        inv.review_notes = notes_stripped or None
    elif body.action == "reject":
        inv.approval_status = "rejected"
        inv.review_notes = notes_stripped
    else:
        inv.approval_status = "needs_revision"
        inv.review_notes = notes_stripped

    inv.reviewed_by_user_id = admin.id
    inv.reviewed_at = now
    db.commit()
    db.refresh(inv)

    clinician = db.query(UserRecord).filter(UserRecord.id == inv.user_id).first()
    full_name = clinician.full_name if clinician else inv.user_id

    return InvoiceRequestAdminOut(
        id=inv.id,
        user_id=inv.user_id,
        clinician_full_name=full_name,
        period_from=inv.period_from,
        period_to=inv.period_to,
        total_hours=inv.total_hours,
        line_count=inv.line_count,
        notes=inv.notes,
        status=inv.status,
        created_at=inv.created_at,
        approval_status=inv.approval_status,
        reviewed_at=inv.reviewed_at,
        review_notes=inv.review_notes,
        reviewed_by_user_id=inv.reviewed_by_user_id,
    )
