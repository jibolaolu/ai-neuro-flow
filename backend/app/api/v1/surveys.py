"""Public NPS satisfaction survey endpoint."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.nps_survey import (
    NpsSurveyRecord,
    SurveyOut,
    SurveySubmitBody,
    generate_survey_token,
)
from app.models.user import UserRecord

router = APIRouter()


@router.get("/public/{token}", response_model=dict)
def get_survey_context(token: str, db: Session = Depends(get_db)) -> dict:
    survey = db.query(NpsSurveyRecord).filter(NpsSurveyRecord.token == token).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey link not found or has expired")
    if survey.submitted_at:
        return {"already_submitted": True, "client_id": survey.client_id}
    client = db.query(ClientRecord).filter(ClientRecord.id == survey.client_id).first()
    return {
        "already_submitted": False,
        "client_name": client.full_name.split()[0] if client else "there",
        "pathway": client.pathway if client else "Assessment",
    }


@router.post("/public/{token}/submit", response_model=dict)
def submit_survey(
    token: str,
    body: SurveySubmitBody,
    db: Session = Depends(get_db),
) -> dict:
    survey = db.query(NpsSurveyRecord).filter(NpsSurveyRecord.token == token).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey link not found")
    if survey.submitted_at:
        raise HTTPException(status_code=400, detail="Survey already submitted")
    if not (0 <= body.nps_score <= 10):
        raise HTTPException(status_code=400, detail="NPS score must be 0-10")
    for field, val in [
        ("satisfaction_score", body.satisfaction_score),
        ("communication_score", body.communication_score),
        ("report_quality_score", body.report_quality_score),
    ]:
        if not (1 <= val <= 5):
            raise HTTPException(status_code=400, detail=f"{field} must be 1-5")

    survey.nps_score = body.nps_score
    survey.satisfaction_score = body.satisfaction_score
    survey.communication_score = body.communication_score
    survey.report_quality_score = body.report_quality_score
    survey.free_text = body.free_text[:2000] if body.free_text else None
    survey.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/create/{client_id}", response_model=dict)
def create_survey_for_client(
    client_id: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    client = db.query(ClientRecord).filter(ClientRecord.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    existing = db.query(NpsSurveyRecord).filter(NpsSurveyRecord.client_id == client_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Survey already exists for this client")

    survey = NpsSurveyRecord(
        id=f"NPS-{uuid.uuid4().hex[:8].upper()}",
        token=generate_survey_token(),
        client_id=client_id,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"ok": True, "token": survey.token}


@router.get("/results", response_model=dict)
def get_survey_results(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    surveys = db.query(NpsSurveyRecord).filter(NpsSurveyRecord.submitted_at.isnot(None)).all()
    if not surveys:
        return {
            "total": 0,
            "avg_nps": None,
            "avg_satisfaction": None,
            "avg_communication": None,
            "avg_report_quality": None,
            "items": [],
        }

    def avg(vals: list) -> float | None:
        clean = [v for v in vals if v is not None]
        return round(sum(clean) / len(clean), 1) if clean else None

    return {
        "total": len(surveys),
        "avg_nps": avg([s.nps_score for s in surveys]),
        "avg_satisfaction": avg([s.satisfaction_score for s in surveys]),
        "avg_communication": avg([s.communication_score for s in surveys]),
        "avg_report_quality": avg([s.report_quality_score for s in surveys]),
        "items": [SurveyOut.model_validate(s) for s in surveys],
    }
