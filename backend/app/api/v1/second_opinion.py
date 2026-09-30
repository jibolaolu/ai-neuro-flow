"""Second-opinion workflow."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.clinical_report import ClinicalReportRecord
from app.models.second_opinion import (
    SecondOpinionAssign,
    SecondOpinionCreate,
    SecondOpinionOut,
    SecondOpinionRequest,
    SecondOpinionRespond,
)
from app.models.user import UserRecord

router = APIRouter()
_log = logging.getLogger(__name__)

_CLINICIAN_ROLES = (
    "clinician",
    "senior-clinician",
    "clinical-admin",
    "super-platform-admin",
)
_ADMIN_ROLES = ("clinical-admin", "super-platform-admin")


def _get_report(report_id: str, db: Session) -> ClinicalReportRecord:
    r = db.query(ClinicalReportRecord).filter(ClinicalReportRecord.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return r


@router.post(
    "/clinical-reports/{report_id}/second-opinion",
    response_model=SecondOpinionOut,
    status_code=201,
)
def request_second_opinion(
    report_id: str,
    body: SecondOpinionCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> SecondOpinionOut:
    require_roles(user, _CLINICIAN_ROLES)
    report = _get_report(report_id, db)

    existing = (
        db.query(SecondOpinionRequest)
        .filter(
            SecondOpinionRequest.report_id == report_id,
            SecondOpinionRequest.status.in_(("requested", "accepted")),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A second-opinion request is already open for this report",
        )

    second_name: str | None = None
    if body.second_clinician_id:
        peer = db.query(UserRecord).filter(UserRecord.id == body.second_clinician_id).first()
        if not peer:
            raise HTTPException(status_code=404, detail="Second clinician not found")
        if peer.role not in ("clinician", "senior-clinician"):
            raise HTTPException(
                status_code=400,
                detail="Second clinician must be a clinician or senior clinician",
            )
        second_name = peer.full_name

    sor = SecondOpinionRequest(
        report_id=report_id,
        client_id=getattr(report, "client_id", None),
        requesting_clinician_id=user.id,
        requesting_clinician_name=user.full_name,
        second_clinician_id=body.second_clinician_id,
        second_clinician_name=second_name,
        status="requested",
        request_note=body.request_note,
    )
    db.add(sor)
    db.commit()
    db.refresh(sor)
    return SecondOpinionOut.model_validate(sor)


@router.get(
    "/clinical-reports/{report_id}/second-opinion",
    response_model=list[SecondOpinionOut],
)
def list_second_opinions(
    report_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[SecondOpinionOut]:
    require_roles(user, _CLINICIAN_ROLES)
    rows = db.query(SecondOpinionRequest).filter(SecondOpinionRequest.report_id == report_id).all()
    return [SecondOpinionOut.model_validate(r) for r in rows]


@router.patch("/second-opinions/{sor_id}/assign", response_model=SecondOpinionOut)
def assign_second_clinician(
    sor_id: str,
    body: SecondOpinionAssign,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> SecondOpinionOut:
    require_roles(user, _ADMIN_ROLES)
    sor = db.query(SecondOpinionRequest).filter(SecondOpinionRequest.id == sor_id).first()
    if not sor:
        raise HTTPException(status_code=404, detail="Second opinion request not found")
    peer = db.query(UserRecord).filter(UserRecord.id == body.second_clinician_id).first()
    if not peer:
        raise HTTPException(status_code=404, detail="Clinician not found")
    sor.second_clinician_id = peer.id
    sor.second_clinician_name = peer.full_name
    db.commit()
    db.refresh(sor)
    return SecondOpinionOut.model_validate(sor)


@router.patch("/second-opinions/{sor_id}/respond", response_model=SecondOpinionOut)
def respond_to_second_opinion(
    sor_id: str,
    body: SecondOpinionRespond,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> SecondOpinionOut:
    require_roles(user, _CLINICIAN_ROLES)
    sor = db.query(SecondOpinionRequest).filter(SecondOpinionRequest.id == sor_id).first()
    if not sor:
        raise HTTPException(status_code=404, detail="Second opinion request not found")
    if body.status not in ("accepted", "completed", "declined"):
        raise HTTPException(status_code=400, detail="status must be accepted, completed, or declined")
    sor.status = body.status
    if body.second_opinion_note:
        sor.second_opinion_note = body.second_opinion_note
    db.commit()
    db.refresh(sor)
    return SecondOpinionOut.model_validate(sor)


@router.get("/second-opinions", response_model=list[SecondOpinionOut])
def list_all_second_opinions(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[SecondOpinionOut]:
    require_roles(user, _ADMIN_ROLES)
    rows = db.query(SecondOpinionRequest).order_by(SecondOpinionRequest.created_at.desc()).all()
    return [SecondOpinionOut.model_validate(r) for r in rows]
