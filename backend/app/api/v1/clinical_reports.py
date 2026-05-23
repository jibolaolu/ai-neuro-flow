"""
Clinical report lifecycle endpoints.

Status flow:  draft → pending → complete → issued

Permissions:
  - clinician / senior-clinician: create, read own, patch draft, submit
  - senior-clinician / clinical-admin: review (approve/reject), issue
  - Public token: read issued PDF metadata (GET /r/{token})
"""

from __future__ import annotations

import json
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.config import document_upload_root
from app.models.client import ClientRecord
from app.models.client_profile import ClientProfileRecord
from app.models.clinical_report import (
    REPORT_STATUS_COMPLETE,
    REPORT_STATUS_DRAFT,
    REPORT_STATUS_ISSUED,
    REPORT_STATUS_PENDING,
    ClinicalReportCreate,
    ClinicalReportOut,
    ClinicalReportPatch,
    ClinicalReportRecord,
)
from app.models.user import UserRecord
from app.services import email as email_svc
from app.services.tenant import effective_clinic_id, get_client_for_user

# redirect_slashes=False prevents the 307 redirect loop that occurs when nginx
# strips the trailing slash from POST /api/v1/clinical-reports/ before forwarding.
# With this set, both /clinical-reports and /clinical-reports/ are accepted directly.
router = APIRouter(redirect_slashes=False)

PDF_TOKEN_TTL_DAYS = 5


def _rpt_id() -> str:
    return f"RPT-{uuid.uuid4().hex[:8].upper()}"


def _token() -> str:
    return secrets.token_urlsafe(32)


def _reports_query(db: Session, user: UserRecord):
    q = db.query(ClinicalReportRecord)
    cid = effective_clinic_id(user)
    if cid is not None:
        q = q.filter(ClinicalReportRecord.clinic_id == cid)
    return q


def _to_out(r: ClinicalReportRecord) -> ClinicalReportOut:
    try:
        sections: dict[str, str] = json.loads(r.sections_json or "{}")
    except (json.JSONDecodeError, TypeError):
        sections = {}
    return ClinicalReportOut(
        id=r.id,
        client_id=r.client_id,
        clinician_id=r.clinician_id,
        report_type=r.report_type,
        status=r.status,
        sections=sections,
        place_of_assessment=r.place_of_assessment,
        date_of_assessment=r.date_of_assessment,
        assessed_by=r.assessed_by,
        pdf_token=r.pdf_token,
        pdf_token_expires_at=r.pdf_token_expires_at,
        reviewed_by_name=r.reviewed_by_name,
        reviewed_at=r.reviewed_at,
        review_comment=r.review_comment,
        submitted_at=r.submitted_at,
        issued_at=r.issued_at,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# ── List reports for a client ─────────────────────────────────────────────────

@router.get("/client/{client_id}", response_model=list[ClinicalReportOut])
def list_reports_for_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> list[ClinicalReportOut]:
    get_client_for_user(db, current_user, client_id)
    query = _reports_query(db, current_user).filter(ClinicalReportRecord.client_id == client_id)
    if current_user.role == "clinician":
        query = query.filter(ClinicalReportRecord.clinician_id == current_user.id)
    return [_to_out(r) for r in query.order_by(ClinicalReportRecord.created_at.desc()).all()]


# ── List MY reports (clinician view) with optional status filter ──────────────

@router.get("/mine", response_model=list[ClinicalReportOut])
def list_my_reports(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> list[ClinicalReportOut]:
    query = _reports_query(db, current_user).filter(
        ClinicalReportRecord.clinician_id == current_user.id
    )
    if status:
        query = query.filter(ClinicalReportRecord.status == status)
    return [_to_out(r) for r in query.order_by(ClinicalReportRecord.created_at.desc()).all()]


# ── List pending (review queue) for senior / admin ───────────────────────────

@router.get("/pending", response_model=list[ClinicalReportOut])
def list_pending_reports(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> list[ClinicalReportOut]:
    query = _reports_query(db, current_user).filter(
        ClinicalReportRecord.status == REPORT_STATUS_PENDING
    )
    # Senior clinicians cannot approve their own reports
    if current_user.role == "senior-clinician":
        query = query.filter(ClinicalReportRecord.clinician_id != current_user.id)
    return [_to_out(r) for r in query.order_by(ClinicalReportRecord.submitted_at.asc()).all()]


# ── Get single report ─────────────────────────────────────────────────────────

@router.get("/{report_id}", response_model=ClinicalReportOut)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> ClinicalReportOut:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user.role == "clinician" and r.clinician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _to_out(r)


# ── Create new report ─────────────────────────────────────────────────────────

@router.post("", response_model=ClinicalReportOut, status_code=201)
def create_report(
    body: ClinicalReportCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> ClinicalReportOut:
    client = get_client_for_user(db, current_user, body.client_id)

    now = datetime.now(timezone.utc)
    r = ClinicalReportRecord(
        id=_rpt_id(),
        clinic_id=client.clinic_id,
        client_id=body.client_id,
        clinician_id=current_user.id,
        report_type=body.report_type,
        status=REPORT_STATUS_DRAFT,
        sections_json="{}",
        date_of_assessment=body.date_of_assessment,
        place_of_assessment=body.place_of_assessment,
        assessed_by=body.assessed_by or current_user.full_name,
        created_at=now,
        updated_at=now,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_out(r)


# ── Auto-save / patch draft ───────────────────────────────────────────────────

@router.patch("/{report_id}", response_model=ClinicalReportOut)
def patch_report(
    report_id: str,
    body: ClinicalReportPatch,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> ClinicalReportOut:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.clinician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this report")
    if r.status not in (REPORT_STATUS_DRAFT,):
        raise HTTPException(status_code=409, detail="Only draft reports can be edited")

    if body.sections is not None:
        r.sections_json = json.dumps(body.sections)
    if body.place_of_assessment is not None:
        r.place_of_assessment = body.place_of_assessment
    if body.date_of_assessment is not None:
        r.date_of_assessment = body.date_of_assessment
    if body.assessed_by is not None:
        r.assessed_by = body.assessed_by
    if body.report_type is not None:
        r.report_type = body.report_type

    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return _to_out(r)


# ── Delete draft report ───────────────────────────────────────────────────────

@router.delete("/{report_id}")
def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> Response:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.clinician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this report")
    if r.status != REPORT_STATUS_DRAFT:
        raise HTTPException(status_code=409, detail="Only draft reports can be deleted")
    db.delete(r)
    db.commit()
    return Response(status_code=204)


# ── Submit for review (draft → pending) ──────────────────────────────────────

@router.post("/{report_id}/submit", response_model=ClinicalReportOut)
def submit_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> ClinicalReportOut:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.clinician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this report")
    if r.status != REPORT_STATUS_DRAFT:
        raise HTTPException(status_code=409, detail="Report is not in draft status")

    now = datetime.now(timezone.utc)
    r.status = REPORT_STATUS_PENDING
    r.submitted_at = now
    r.updated_at = now
    db.commit()
    db.refresh(r)
    return _to_out(r)


# ── Approve / reject (pending → complete or back to draft) ───────────────────

class ReviewBody:
    def __init__(self, approved: bool = True, comment: str | None = None):
        self.approved = approved
        self.comment = comment

from pydantic import BaseModel as _BM

class ReviewIn(_BM):
    approved: bool = True
    comment: str | None = None


@router.post("/{report_id}/review", response_model=ClinicalReportOut)
def review_report(
    report_id: str,
    body: ReviewIn,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> ClinicalReportOut:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.status != REPORT_STATUS_PENDING:
        raise HTTPException(status_code=409, detail="Report is not pending review")
    # Senior clinicians cannot approve their own submissions
    if current_user.role == "senior-clinician" and r.clinician_id == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot approve your own report")

    now = datetime.now(timezone.utc)
    r.reviewed_by_id = current_user.id
    r.reviewed_by_name = current_user.full_name
    r.reviewed_at = now
    r.review_comment = body.comment
    r.updated_at = now

    if body.approved:
        r.status = REPORT_STATUS_COMPLETE
        _generate_and_attach_pdf(r, db)
    else:
        # Send back to draft so clinician can amend
        r.status = REPORT_STATUS_DRAFT
        r.submitted_at = None

    db.commit()
    db.refresh(r)
    return _to_out(r)


# ── Issue report (complete → issued) — sends PDF to client ───────────────────

@router.post("/{report_id}/issue", response_model=ClinicalReportOut)
def issue_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> ClinicalReportOut:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if r.status != REPORT_STATUS_COMPLETE:
        raise HTTPException(status_code=409, detail="Report must be complete before issuing")

    now = datetime.now(timezone.utc)
    r.status = REPORT_STATUS_ISSUED
    r.issued_at = now
    r.updated_at = now

    # Create/renew public PDF token (expires in 5 days)
    r.pdf_token = _token()
    r.pdf_token_expires_at = now + timedelta(days=PDF_TOKEN_TTL_DAYS)

    db.commit()
    db.refresh(r)

    # Send report to client
    _send_report_to_client(r, db)

    # Notify the authoring clinician
    _notify_clinician_issued(r, db)

    return _to_out(r)


# ── Download PDF (authenticated staff) ───────────────────────────────────────

@router.get("/{report_id}/pdf")
def download_pdf_authenticated(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> Response:
    r = _reports_query(db, current_user).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user.role == "clinician" and r.clinician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not r.pdf_path or not Path(r.pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF not yet generated")
    pdf_bytes = Path(r.pdf_path).read_bytes()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{r.id}.pdf"'},
    )


# ── Public token PDF access (client link) ─────────────────────────────────────

@router.get("/token/{token}/pdf")
def download_pdf_by_token(
    token: str,
    db: Session = Depends(get_db),
) -> Response:
    r = db.query(ClinicalReportRecord).filter(ClinicalReportRecord.pdf_token == token).first()
    if not r:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    now = datetime.now(timezone.utc)
    # Token expired → link no longer accessible, but PDF itself can still be read by staff
    if r.pdf_token_expires_at and r.pdf_token_expires_at < now:
        raise HTTPException(status_code=410, detail="This report link has expired. Please contact the clinic.")
    if not r.pdf_path or not Path(r.pdf_path).exists():
        raise HTTPException(status_code=404, detail="Report PDF not available")
    pdf_bytes = Path(r.pdf_path).read_bytes()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="assessment-report.pdf"'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_and_attach_pdf(r: ClinicalReportRecord, db: Session) -> None:
    """Generate PDF and save to disk; attach path to record (caller must commit)."""
    from app.services.pdf_generator import generate_report_pdf

    client = db.query(ClientRecord).filter(ClientRecord.id == r.client_id).first()
    clinician = db.query(UserRecord).filter(UserRecord.id == r.clinician_id).first()
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == r.client_id).first()

    try:
        sections: dict[str, str] = json.loads(r.sections_json or "{}")
    except (json.JSONDecodeError, TypeError):
        sections = {}

    client_name = (client.child_name or client.full_name) if client else "Unknown"
    pdf_bytes = generate_report_pdf(
        report_type=r.report_type,
        client_name=client_name,
        client_dob=(profile.date_of_birth if profile else None) or (client.child_dob if client else None),
        client_nhs_ref=None,
        client_address=(profile.address if profile else None) or (client.address if client else None),
        client_icb=None,
        gp_name=(profile.gp_name if profile else None) or (client.gp_name if client else None),
        gp_address=(profile.gp_practice if profile else None) or (client.gp_practice if client else None),
        date_of_assessment=r.date_of_assessment,
        place_of_assessment=r.place_of_assessment,
        assessed_by=r.assessed_by or (clinician.full_name if clinician else None),
        sections=sections,
        clinician_name=clinician.full_name if clinician else "Unknown",
        report_id=r.id,
    )

    # Save to uploads directory
    upload_root = document_upload_root() / "reports"
    upload_root.mkdir(parents=True, exist_ok=True)
    pdf_path = upload_root / f"{r.id}.pdf"
    pdf_path.write_bytes(pdf_bytes)
    r.pdf_path = str(pdf_path)


def _send_report_to_client(r: ClinicalReportRecord, db: Session) -> None:
    """Email the PDF and token link to the client / parent."""
    client = db.query(ClientRecord).filter(ClientRecord.id == r.client_id).first()
    if not client:
        return

    from app.core.config import settings

    token_link = f"{settings.platform_base_url}/report/{r.pdf_token}"
    recipient_name = client.full_name
    recipient_email = client.email

    # Build PDF attachment bytes if available
    pdf_bytes: bytes | None = None
    if r.pdf_path and Path(r.pdf_path).exists():
        pdf_bytes = Path(r.pdf_path).read_bytes()

    email_svc.send_report_issued(
        to_email=recipient_email,
        client_id=client.id,
        recipient_name=recipient_name,
        report_type=r.report_type,
        token_link=token_link,
        pdf_bytes=pdf_bytes,
        pdf_filename=f"{r.id}.pdf",
    )


def _notify_clinician_issued(r: ClinicalReportRecord, db: Session) -> None:
    """Notify the authoring clinician that their report has been issued."""
    clinician = db.query(UserRecord).filter(UserRecord.id == r.clinician_id).first()
    if not clinician:
        return
    client = db.query(ClientRecord).filter(ClientRecord.id == r.client_id).first()
    client_display = (client.child_name or client.full_name) if client else r.client_id

    email_svc.send_report_issued_clinician_notification(
        to_email=clinician.email,
        clinician_name=clinician.full_name,
        client_name=client_display,
        report_type=r.report_type,
        report_id=r.id,
    )
