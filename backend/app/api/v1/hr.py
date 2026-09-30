"""HR module API — feature settings matrix + all HR CRUD endpoints."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.hr import (
    HR_DEFAULT_ROLES,
    HR_FEATURE_LABELS,
    HR_FEATURES,
    HrContractCreate,
    HrContractOut,
    HrContractRecord,
    HrContractUpdate,
    HrFeatureSettingOut,
    HrFeatureSettingRecord,
    HrFeatureSettingUpdate,
    HrIncidentCreate,
    HrIncidentOut,
    HrIncidentRecord,
    HrIncidentUpdate,
    HrLeaveCreate,
    HrLeaveOut,
    HrLeaveRequestRecord,
    HrLeaveUpdate,
    HrSupervisionCreate,
    HrSupervisionOut,
    HrSupervisionRecord,
    HrTimesheetCreate,
    HrTimesheetOut,
    HrTimesheetRecord,
    HrTimesheetUpdate,
    HrTrainingCreate,
    HrTrainingOut,
    HrTrainingRecord,
    HrTrainingUpdate,
    _roles_from_record,
)
from app.models.user import UserRecord
from app.services.audit import log_event

router = APIRouter()

_ADMIN_ROLES = ("clinical-admin", "super-platform-admin")
_SENIOR_ADMIN_ROLES = ("super-platform-admin",)


def _short_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def _ensure_settings(db: Session) -> None:
    for key in HR_FEATURES:
        if not db.query(HrFeatureSettingRecord).filter(HrFeatureSettingRecord.feature_key == key).first():
            db.add(
                HrFeatureSettingRecord(
                    feature_key=key,
                    enabled=True,
                    allowed_roles_json=json.dumps(HR_DEFAULT_ROLES[key]),
                )
            )
    db.commit()


def _check_feature_access(db: Session, feature_key: str, user_role: str) -> None:
    _ensure_settings(db)
    rec = db.query(HrFeatureSettingRecord).filter(HrFeatureSettingRecord.feature_key == feature_key).first()
    if not rec or not rec.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This HR feature is not enabled",
        )
    allowed = _roles_from_record(rec)
    if user_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role does not have access to this HR feature",
        )


# ── Feature Settings ──────────────────────────────────────────────────────────


@router.get("/settings", response_model=list[HrFeatureSettingOut])
def list_hr_settings(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> list[HrFeatureSettingOut]:
    _ensure_settings(db)
    rows = db.query(HrFeatureSettingRecord).all()
    return [
        HrFeatureSettingOut(
            feature_key=r.feature_key,
            label=HR_FEATURE_LABELS.get(r.feature_key, r.feature_key),
            enabled=r.enabled,
            allowed_roles=_roles_from_record(r),
        )
        for r in rows
    ]


@router.patch("/settings/{feature_key}", response_model=HrFeatureSettingOut)
def update_hr_setting(
    feature_key: str,
    body: HrFeatureSettingUpdate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> HrFeatureSettingOut:
    _ensure_settings(db)
    rec = db.query(HrFeatureSettingRecord).filter(HrFeatureSettingRecord.feature_key == feature_key).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Feature setting not found")
    if body.enabled is not None:
        rec.enabled = body.enabled
    if body.allowed_roles is not None:
        rec.allowed_roles_json = json.dumps(body.allowed_roles)
    db.commit()
    return HrFeatureSettingOut(
        feature_key=rec.feature_key,
        label=HR_FEATURE_LABELS.get(rec.feature_key, rec.feature_key),
        enabled=rec.enabled,
        allowed_roles=_roles_from_record(rec),
    )


# ── Leave ──────────────────────────────────────────────────────────────────────


@router.get("/leave", response_model=list[HrLeaveOut])
def list_leave(
    user_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[HrLeaveOut]:
    _check_feature_access(db, "leave", user.role)
    q = db.query(HrLeaveRequestRecord)
    if user.role not in _ADMIN_ROLES:
        q = q.filter(HrLeaveRequestRecord.user_id == user.id)
    elif user_id:
        q = q.filter(HrLeaveRequestRecord.user_id == user_id)
    return [HrLeaveOut.model_validate(r) for r in q.order_by(HrLeaveRequestRecord.created_at.desc()).all()]


@router.post("/leave", response_model=HrLeaveOut, status_code=201)
def create_leave(
    body: HrLeaveCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrLeaveOut:
    _check_feature_access(db, "leave", user.role)
    rec = HrLeaveRequestRecord(
        id=_short_id("LV"),
        user_id=user.id,
        user_name=user.full_name,
        **body.model_dump(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return HrLeaveOut.model_validate(rec)


@router.patch("/leave/{leave_id}", response_model=HrLeaveOut)
def update_leave(
    leave_id: str,
    body: HrLeaveUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrLeaveOut:
    _check_feature_access(db, "leave", user.role)
    rec = db.query(HrLeaveRequestRecord).filter(HrLeaveRequestRecord.id == leave_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if user.role not in _ADMIN_ROLES and rec.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if body.status and user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can change leave status")
    if body.status:
        rec.reviewed_by_user_id = user.id
        rec.reviewed_by_name = user.full_name
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    db.commit()
    db.refresh(rec)
    return HrLeaveOut.model_validate(rec)


@router.delete("/leave/{leave_id}", status_code=204, response_class=Response)
def delete_leave(
    leave_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> None:
    _check_feature_access(db, "leave", user.role)
    rec = db.query(HrLeaveRequestRecord).filter(HrLeaveRequestRecord.id == leave_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if user.role not in _ADMIN_ROLES and rec.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(rec)
    db.commit()


# ── Timesheets ─────────────────────────────────────────────────────────────────


@router.get("/timesheets", response_model=list[HrTimesheetOut])
def list_timesheets(
    user_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[HrTimesheetOut]:
    _check_feature_access(db, "timesheets", user.role)
    q = db.query(HrTimesheetRecord)
    if user.role not in _ADMIN_ROLES:
        q = q.filter(HrTimesheetRecord.user_id == user.id)
    elif user_id:
        q = q.filter(HrTimesheetRecord.user_id == user_id)
    return [HrTimesheetOut.model_validate(r) for r in q.order_by(HrTimesheetRecord.week_start.desc()).all()]


@router.post("/timesheets", response_model=HrTimesheetOut, status_code=201)
def create_timesheet(
    body: HrTimesheetCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrTimesheetOut:
    _check_feature_access(db, "timesheets", user.role)
    existing = (
        db.query(HrTimesheetRecord)
        .filter(
            HrTimesheetRecord.user_id == user.id,
            HrTimesheetRecord.week_start == body.week_start,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Timesheet already exists for this week")
    rec = HrTimesheetRecord(
        id=_short_id("TS"),
        user_id=user.id,
        user_name=user.full_name,
        **body.model_dump(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return HrTimesheetOut.model_validate(rec)


@router.patch("/timesheets/{ts_id}", response_model=HrTimesheetOut)
def update_timesheet(
    ts_id: str,
    body: HrTimesheetUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrTimesheetOut:
    _check_feature_access(db, "timesheets", user.role)
    rec = db.query(HrTimesheetRecord).filter(HrTimesheetRecord.id == ts_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    if user.role not in _ADMIN_ROLES and rec.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if body.status and user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can change timesheet status")
    if body.status == "approved":
        rec.reviewed_by_user_id = user.id
        rec.reviewed_by_name = user.full_name
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    db.commit()
    db.refresh(rec)
    return HrTimesheetOut.model_validate(rec)


# ── Supervision ────────────────────────────────────────────────────────────────


@router.get("/supervision", response_model=list[HrSupervisionOut])
def list_supervision(
    user_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[HrSupervisionOut]:
    _check_feature_access(db, "supervision", user.role)
    q = db.query(HrSupervisionRecord)
    if user.role not in _ADMIN_ROLES:
        q = q.filter(HrSupervisionRecord.supervisee_user_id == user.id)
    elif user_id:
        q = q.filter(HrSupervisionRecord.supervisee_user_id == user_id)
    return [HrSupervisionOut.model_validate(r) for r in q.order_by(HrSupervisionRecord.session_date.desc()).all()]


@router.post("/supervision", response_model=HrSupervisionOut, status_code=201)
def create_supervision(
    body: HrSupervisionCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrSupervisionOut:
    _check_feature_access(db, "supervision", user.role)
    supervisor_name: str | None = None
    if body.supervisor_user_id:
        sup = db.query(UserRecord).filter(UserRecord.id == body.supervisor_user_id).first()
        supervisor_name = sup.full_name if sup else None
    supervisee_name: str | None = None
    supervisee = db.query(UserRecord).filter(UserRecord.id == body.supervisee_user_id).first()
    if supervisee:
        supervisee_name = supervisee.full_name

    rec = HrSupervisionRecord(
        id=_short_id("SUP"),
        supervisee_name=supervisee_name,
        supervisor_name=supervisor_name,
        created_by_user_id=user.id,
        **body.model_dump(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return HrSupervisionOut.model_validate(rec)


@router.delete("/supervision/{sup_id}", status_code=204, response_class=Response)
def delete_supervision(
    sup_id: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> None:
    rec = db.query(HrSupervisionRecord).filter(HrSupervisionRecord.id == sup_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Supervision record not found")
    db.delete(rec)
    db.commit()


# ── Training ───────────────────────────────────────────────────────────────────


@router.get("/training", response_model=list[HrTrainingOut])
def list_training(
    user_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[HrTrainingOut]:
    _check_feature_access(db, "training", user.role)
    q = db.query(HrTrainingRecord)
    if user.role not in _ADMIN_ROLES:
        q = q.filter(HrTrainingRecord.user_id == user.id)
    elif user_id:
        q = q.filter(HrTrainingRecord.user_id == user_id)
    return [HrTrainingOut.model_validate(r) for r in q.order_by(HrTrainingRecord.created_at.desc()).all()]


@router.post("/training", response_model=HrTrainingOut, status_code=201)
def create_training(
    body: HrTrainingCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrTrainingOut:
    _check_feature_access(db, "training", user.role)
    if user.role not in _ADMIN_ROLES:
        body_data = body.model_dump()
        body_data["user_id"] = user.id
    else:
        body_data = body.model_dump()
    rec = HrTrainingRecord(
        id=_short_id("TR"),
        user_name=(db.query(UserRecord).filter(UserRecord.id == body_data["user_id"]).first() or type("", (), {"full_name": ""})()).full_name or None,
        created_by_user_id=user.id,
        **body_data,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return HrTrainingOut.model_validate(rec)


@router.patch("/training/{tr_id}", response_model=HrTrainingOut)
def update_training(
    tr_id: str,
    body: HrTrainingUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrTrainingOut:
    _check_feature_access(db, "training", user.role)
    rec = db.query(HrTrainingRecord).filter(HrTrainingRecord.id == tr_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Training record not found")
    if user.role not in _ADMIN_ROLES and rec.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    db.commit()
    db.refresh(rec)
    return HrTrainingOut.model_validate(rec)


@router.delete("/training/{tr_id}", status_code=204, response_class=Response)
def delete_training(
    tr_id: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> None:
    rec = db.query(HrTrainingRecord).filter(HrTrainingRecord.id == tr_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Training record not found")
    db.delete(rec)
    db.commit()


# ── Incidents ──────────────────────────────────────────────────────────────────


@router.get("/incidents", response_model=list[HrIncidentOut])
def list_incidents(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[HrIncidentOut]:
    _check_feature_access(db, "incidents", user.role)
    q = db.query(HrIncidentRecord)
    if user.role not in _ADMIN_ROLES:
        q = q.filter(HrIncidentRecord.reporter_user_id == user.id)
    return [HrIncidentOut.model_validate(r) for r in q.order_by(HrIncidentRecord.created_at.desc()).all()]


@router.post("/incidents", response_model=HrIncidentOut, status_code=201)
def create_incident(
    body: HrIncidentCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrIncidentOut:
    _check_feature_access(db, "incidents", user.role)
    rec = HrIncidentRecord(
        id=_short_id("INC"),
        reporter_user_id=user.id,
        reporter_name=user.full_name,
        **body.model_dump(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    log_event(
        db,
        "incident_reported",
        actor_user_id=user.id,
        actor_name=user.full_name,
        target_type="hr_incident",
        target_id=rec.id,
        detail=rec.title,
    )
    return HrIncidentOut.model_validate(rec)


@router.patch("/incidents/{inc_id}", response_model=HrIncidentOut)
def update_incident(
    inc_id: str,
    body: HrIncidentUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> HrIncidentOut:
    _check_feature_access(db, "incidents", user.role)
    rec = db.query(HrIncidentRecord).filter(HrIncidentRecord.id == inc_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Incident not found")
    if user.role not in _ADMIN_ROLES and rec.reporter_user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if body.status and user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admins can change incident status")
    if body.status and user.role in _ADMIN_ROLES:
        rec.reviewed_by_user_id = user.id
        rec.reviewed_by_name = user.full_name
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    db.commit()
    db.refresh(rec)
    return HrIncidentOut.model_validate(rec)


# ── Contracts ──────────────────────────────────────────────────────────────────


@router.get("/contracts", response_model=list[HrContractOut])
def list_contracts(
    user_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> list[HrContractOut]:
    _check_feature_access(db, "contracts", user.role)
    q = db.query(HrContractRecord)
    if user_id:
        q = q.filter(HrContractRecord.user_id == user_id)
    return [HrContractOut.model_validate(r) for r in q.order_by(HrContractRecord.created_at.desc()).all()]


@router.post("/contracts", response_model=HrContractOut, status_code=201)
def create_contract(
    body: HrContractCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> HrContractOut:
    _check_feature_access(db, "contracts", user.role)
    member = db.query(UserRecord).filter(UserRecord.id == body.user_id).first()
    rec = HrContractRecord(
        id=_short_id("CT"),
        user_name=member.full_name if member else None,
        created_by_user_id=user.id,
        created_by_name=user.full_name,
        **body.model_dump(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return HrContractOut.model_validate(rec)


@router.patch("/contracts/{ct_id}", response_model=HrContractOut)
def update_contract(
    ct_id: str,
    body: HrContractUpdate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(*_ADMIN_ROLES)),
) -> HrContractOut:
    rec = db.query(HrContractRecord).filter(HrContractRecord.id == ct_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Contract not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    db.commit()
    db.refresh(rec)
    return HrContractOut.model_validate(rec)
