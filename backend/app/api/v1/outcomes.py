"""
Post-assessment outcome tracking endpoints.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client_profile import ClientProfileRecord
from app.models.outcome import OutcomeCreate, OutcomeList, OutcomeOut, OutcomeRecord
from app.models.user import UserRecord
from app.services.tenant import effective_clinic_id, get_client_for_user

router = APIRouter(redirect_slashes=False)

_CLINICAL_ROLES = ("clinician", "senior-clinician", "clinical-admin", "clinic-admin")


def _outcome_id() -> str:
    return f"OUT-{uuid.uuid4().hex[:8].upper()}"


@router.get("", response_model=OutcomeList)
def list_outcomes(
    client_id: str | None = None,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    q = db.query(OutcomeRecord)
    cid = effective_clinic_id(user)
    if cid:
        q = q.filter(OutcomeRecord.clinic_id == cid)
    if client_id:
        q = q.filter(OutcomeRecord.client_id == client_id)
    rows = q.order_by(OutcomeRecord.created_at.desc()).all()
    return OutcomeList(items=rows, total=len(rows))


@router.post("/{client_id}", response_model=OutcomeOut, status_code=status.HTTP_201_CREATED)
def create_outcome(
    client_id: str,
    payload:   OutcomeCreate,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    client = get_client_for_user(db, user, client_id)

    clinic_id = effective_clinic_id(user)

    # Optionally generate AI outcome prediction
    ai_prediction: str | None = None
    try:
        profile = db.query(ClientProfileRecord).filter(
            ClientProfileRecord.client_id == client_id
        ).first()
        scores = json.loads(profile.scores or "{}") if profile else {}
        if scores:
            from app.ai.llm_gateway import llm_gateway
            pred = llm_gateway.call_json(
                "Based on the following assessment scores, predict treatment outcomes. "
                "Return JSON: {predicted_response: string, prognosis: string, "
                "key_factors: [], monitoring_points: []}.\n\n"
                f"Scores:\n{json.dumps(scores, indent=2)}\n"
                f"Final diagnosis: {payload.final_diagnosis or 'not recorded'}",
                max_tokens=500,
            )
            ai_prediction = json.dumps(pred)
    except Exception:
        pass

    outcome = OutcomeRecord(
        id=_outcome_id(),
        client_id=client_id,
        clinic_id=clinic_id,
        assessment_id=client.assessment_id,
        recorded_by=user.id,
        recorded_by_name=getattr(user, "full_name", None) or user.email,
        final_diagnosis=payload.final_diagnosis,
        treatment_plan=payload.treatment_plan,
        referrals_made=json.dumps(payload.referrals_made) if payload.referrals_made else None,
        follow_up_date=payload.follow_up_date,
        client_feedback=payload.client_feedback,
        outcome_score=payload.outcome_score,
        notes=payload.notes,
        ai_prediction=ai_prediction,
    )
    db.add(outcome)
    db.commit()
    db.refresh(outcome)
    return outcome


@router.get("/{client_id}/latest", response_model=OutcomeOut)
def get_latest_outcome(
    client_id: str,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    get_client_for_user(db, user, client_id)
    outcome = (
        db.query(OutcomeRecord)
        .filter(OutcomeRecord.client_id == client_id)
        .order_by(OutcomeRecord.created_at.desc())
        .first()
    )
    if not outcome:
        raise HTTPException(404, "No outcomes recorded for this client")
    return outcome
