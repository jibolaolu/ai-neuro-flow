"""
Prescribing & Titration module.
Tracks medications, titration phases, monitoring, and generates shared-care letters.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.prescription import PrescriptionRecord
from app.core.tenant import effective_clinic_id

router = APIRouter()

# ── Common ADHD/autism medications for auto-complete ─────────────────────────
ADHD_MEDICATIONS = [
    {"name": "Methylphenidate", "formulations": ["immediate-release tablet", "modified-release capsule", "patch"],
     "titration_steps": [{"phase": 1, "dose_mg": 5, "duration_weeks": 2, "notes": "Starter dose — monitor BP/HR"},
                         {"phase": 2, "dose_mg": 10, "duration_weeks": 2, "notes": "Increase if tolerated"},
                         {"phase": 3, "dose_mg": 18, "duration_weeks": 2, "notes": "Standard dose"},
                         {"phase": 4, "dose_mg": 27, "duration_weeks": 4, "notes": "If insufficient response"},
                         {"phase": 5, "dose_mg": 36, "duration_weeks": 4, "notes": "Maximum standard dose"}]},
    {"name": "Lisdexamfetamine (Vyvanse)", "formulations": ["capsule"],
     "titration_steps": [{"phase": 1, "dose_mg": 20, "duration_weeks": 2, "notes": "Starting dose"},
                         {"phase": 2, "dose_mg": 30, "duration_weeks": 2, "notes": "First increase"},
                         {"phase": 3, "dose_mg": 40, "duration_weeks": 2, "notes": "If insufficient"},
                         {"phase": 4, "dose_mg": 50, "duration_weeks": 4, "notes": "Optimal range start"},
                         {"phase": 5, "dose_mg": 60, "duration_weeks": 4, "notes": "Approach maximum"},
                         {"phase": 6, "dose_mg": 70, "duration_weeks": 4, "notes": "Maximum licensed dose"}]},
    {"name": "Atomoxetine (Strattera)", "formulations": ["capsule"],
     "titration_steps": [{"phase": 1, "dose_mg": 40, "duration_weeks": 4, "notes": "Initial — takes 4-6 wk for effect"},
                         {"phase": 2, "dose_mg": 60, "duration_weeks": 4, "notes": "Increase after minimum 4 weeks"},
                         {"phase": 3, "dose_mg": 80, "duration_weeks": 4, "notes": "If insufficient response"},
                         {"phase": 4, "dose_mg": 100, "duration_weeks": 8, "notes": "Max 100mg/day"}]},
    {"name": "Guanfacine (Intuniv)", "formulations": ["modified-release tablet"],
     "titration_steps": [{"phase": 1, "dose_mg": 1, "duration_weeks": 1, "notes": "Slow up-titration required"},
                         {"phase": 2, "dose_mg": 2, "duration_weeks": 1, "notes": "Increase weekly"},
                         {"phase": 3, "dose_mg": 3, "duration_weeks": 1, "notes": "Target range"},
                         {"phase": 4, "dose_mg": 4, "duration_weeks": 2, "notes": "Maximum in children"}]},
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class TitrationStep(BaseModel):
    phase: int
    dose_mg: float
    duration_weeks: int
    notes: str = ""


class PrescriptionCreate(BaseModel):
    client_id: int
    medication: str
    formulation: Optional[str] = None
    dose_mg: Optional[float] = None
    frequency: Optional[str] = "once daily"
    route: Optional[str] = "oral"
    indication: Optional[str] = None
    titration_plan: Optional[List[TitrationStep]] = None
    start_date: Optional[date] = None
    review_date: Optional[date] = None


class TitrateBody(BaseModel):
    direction: str  # "up" | "down"
    notes: Optional[str] = None


class SharedCareBody(BaseModel):
    gp_name: str
    gp_email: str


class StopBody(BaseModel):
    reason: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_prescription(db: Session, clinic_id: int, rx_id: int) -> PrescriptionRecord:
    rx = db.query(PrescriptionRecord).filter(
        PrescriptionRecord.id == rx_id,
        PrescriptionRecord.clinic_id == clinic_id,
    ).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return rx


def _generate_shared_care_letter(rx: PrescriptionRecord, gp_name: str) -> str:
    today = date.today().strftime("%d %B %Y")
    return f"""SHARED CARE AGREEMENT REQUEST
Date: {today}

Dear {gp_name},

RE: Continuation of stimulant medication under shared care

I am writing to request your participation in a shared care agreement for the above patient who has been diagnosed with Attention Deficit Hyperactivity Disorder (ADHD) following a comprehensive private assessment.

CURRENT MEDICATION
Medication:    {rx.medication}
Formulation:   {rx.formulation or 'standard'}
Dose:          {rx.dose_mg or '—'} mg
Frequency:     {rx.frequency or 'once daily'}
Route:         {rx.route or 'oral'}
Indication:    {rx.indication or 'ADHD'}
Titration phase: {rx.titration_phase}

CLINICAL SUMMARY
The patient has been stabilised on the above medication following a structured titration programme. They are currently responding well with improvement in attention, executive function, and daily functioning. No significant adverse effects have been reported.

MONITORING REQUIREMENTS (specialist responsibility)
• Annual review including symptom assessment and medication optimisation
• 6-monthly cardiovascular monitoring (BP, HR, weight)
• Safeguarding and mental health review

GP RESPONSIBILITIES UNDER SHARED CARE
• Monthly prescription of the above medication
• Blood pressure and pulse monitoring at each prescription
• Report any concerns (cardiovascular, psychiatric, growth in under-18s) to the specialist team
• Refer back if control deteriorates

CONTACT
Please contact our clinic team to confirm acceptance of shared care responsibility.

Yours sincerely,
NeuroFlow Clinical Team
"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/medications")
def list_medications():
    """Reference list of common ADHD medications with default titration plans."""
    return ADHD_MEDICATIONS


@router.get("/client/{client_id}")
def list_for_client(
    client_id: int,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    rxs = db.query(PrescriptionRecord).filter(
        PrescriptionRecord.clinic_id == cid,
        PrescriptionRecord.client_id == client_id,
    ).order_by(PrescriptionRecord.created_at.desc()).all()
    return [r.to_dict() for r in rxs]


@router.post("/", status_code=201)
def create_prescription(
    body: PrescriptionCreate,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    plan_json = None
    if body.titration_plan:
        plan_json = json.dumps([s.model_dump() for s in body.titration_plan])
    else:
        # Auto-fill from medication reference if known
        med_ref = next((m for m in ADHD_MEDICATIONS if m["name"].lower() in body.medication.lower()), None)
        if med_ref:
            plan_json = json.dumps(med_ref["titration_steps"])

    rx = PrescriptionRecord(
        clinic_id=cid,
        client_id=body.client_id,
        prescriber_id=user.id,
        medication=body.medication,
        formulation=body.formulation,
        dose_mg=body.dose_mg,
        frequency=body.frequency,
        route=body.route,
        indication=body.indication,
        titration_plan=plan_json,
        start_date=body.start_date or date.today(),
        review_date=body.review_date or (date.today() + timedelta(weeks=8)),
    )
    db.add(rx)
    db.commit()
    db.refresh(rx)
    return rx.to_dict()


@router.get("/{rx_id}")
def get_prescription(
    rx_id: int,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    return _get_prescription(db, cid, rx_id).to_dict()


@router.put("/{rx_id}")
def update_prescription(
    rx_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    rx = _get_prescription(db, cid, rx_id)
    allowed = {"dose_mg", "frequency", "formulation", "review_date", "monitoring_notes", "side_effects", "titration_notes"}
    for k, v in body.items():
        if k in allowed:
            setattr(rx, k, v)
    rx.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rx)
    return rx.to_dict()


@router.post("/{rx_id}/titrate")
def titrate(
    rx_id: int,
    body: TitrateBody,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Step titration up or down by one phase."""
    cid = effective_clinic_id(user)
    rx = _get_prescription(db, cid, rx_id)
    steps = rx.titration_steps
    if body.direction == "up":
        new_phase = rx.titration_phase + 1
    elif body.direction == "down":
        new_phase = max(1, rx.titration_phase - 1)
    else:
        raise HTTPException(status_code=400, detail="direction must be 'up' or 'down'")

    next_step = next((s for s in steps if s.get("phase") == new_phase), None)
    rx.titration_phase = new_phase
    if next_step:
        rx.dose_mg = next_step.get("dose_mg", rx.dose_mg)
        rx.review_date = date.today() + timedelta(weeks=next_step.get("duration_weeks", 4))
    if body.notes:
        rx.titration_notes = (rx.titration_notes or "") + f"\n[{date.today()}] Phase {new_phase}: {body.notes}"
    rx.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rx)
    return {**rx.to_dict(), "applied_step": next_step}


@router.post("/{rx_id}/shared-care")
def request_shared_care(
    rx_id: int,
    body: SharedCareBody,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Generate and (mock) send a shared-care letter to the GP."""
    cid = effective_clinic_id(user)
    rx = _get_prescription(db, cid, rx_id)
    letter = _generate_shared_care_letter(rx, body.gp_name)
    rx.shared_care_requested = True
    rx.shared_care_gp_name = body.gp_name
    rx.shared_care_gp_email = body.gp_email
    rx.shared_care_sent_at = datetime.utcnow()
    db.commit()
    return {"status": "sent", "gp_email": body.gp_email, "letter": letter}


@router.post("/{rx_id}/stop")
def stop_prescription(
    rx_id: int,
    body: StopBody,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    rx = _get_prescription(db, cid, rx_id)
    rx.status = "stopped"
    rx.stop_reason = body.reason
    rx.end_date = date.today()
    rx.updated_at = datetime.utcnow()
    db.commit()
    return rx.to_dict()
