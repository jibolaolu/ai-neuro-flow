"""
Caldicott / Information Governance workflow.
Manages data-sharing approvals, Caldicott principle assessments,
and DSPT (Data Security & Protection Toolkit) evidence tracking.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.ig_workflow import CaldicottRequest, DsptChecklist
from app.core.tenant import effective_clinic_id

router = APIRouter()

# ── DSPT standard definitions ─────────────────────────────────────────────────
DSPT_STANDARDS = [
    {"id": "1", "title": "Personal Confidential Data", "description": "Staff understand their responsibilities for handling personal confidential data"},
    {"id": "2", "title": "Staff Responsibilities", "description": "All staff complete annual data security training"},
    {"id": "3", "title": "Training", "description": "Training completion rate ≥95% of workforce"},
    {"id": "4", "title": "Managing Data Access", "description": "Access to systems is controlled and audited"},
    {"id": "5", "title": "Process Reviews", "description": "Processes are reviewed following security incidents"},
    {"id": "6", "title": "Responding to Incidents", "description": "Cyber incidents and near misses are reported"},
    {"id": "7", "title": "Continuity Planning", "description": "Continuity plans are in place for data and cyber security incidents"},
    {"id": "8", "title": "Unsupported Systems", "description": "Unsupported systems that store or process personal data have been identified"},
    {"id": "9", "title": "IT Protection", "description": "Strategies are in place to protect the organisation from malware"},
    {"id": "10", "title": "Accountable Suppliers", "description": "Data processors and ICT suppliers have a contract that reflects data security obligations"},
]

CALDICOTT_PRINCIPLES = {
    "1": "Justify the purpose(s) for using confidential information",
    "2": "Use only what is needed",
    "3": "Access only what is needed",
    "4": "Be aware of your responsibilities",
    "5": "Comply with the law",
    "6": "Understand and comply with your organisation's confidentiality procedures",
    "7": "The duty to share can be as important as the duty to protect",
}

REQUEST_TYPES = ["data-share", "subject-access", "third-party-disclosure", "research", "audit", "safeguarding"]


# ── Schemas ───────────────────────────────────────────────────────────────────

class CaldicottCreate(BaseModel):
    request_type: str
    purpose: str
    data_described: str
    recipients: Optional[str] = None
    legal_basis: Optional[str] = None
    principles_met: Optional[dict] = None
    minimisation_applied: bool = False
    minimisation_notes: Optional[str] = None


class CaldicottDecision(BaseModel):
    decision: str  # "approved" | "rejected" | "deferred"
    notes: Optional[str] = None


class DsptUpdate(BaseModel):
    standard_id: str
    status: str   # "met" | "not-met" | "in-progress" | "not-applicable"
    evidence: Optional[str] = None
    notes: Optional[str] = None


# ── Caldicott request endpoints ───────────────────────────────────────────────

@router.get("/caldicott")
def list_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    q = db.query(CaldicottRequest).filter(CaldicottRequest.clinic_id == cid)
    if status:
        q = q.filter(CaldicottRequest.status == status)
    rows = q.order_by(CaldicottRequest.created_at.desc()).all()
    return [r.to_dict() for r in rows]


@router.post("/caldicott", status_code=201)
def create_request(
    body: CaldicottCreate,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    if body.request_type not in REQUEST_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid request_type. Valid: {REQUEST_TYPES}")
    req = CaldicottRequest(
        clinic_id=cid,
        requester_id=user.id,
        request_type=body.request_type,
        purpose=body.purpose,
        data_described=body.data_described,
        recipients=body.recipients,
        legal_basis=body.legal_basis,
        principles_met=json.dumps(body.principles_met or {}),
        minimisation_applied=body.minimisation_applied,
        minimisation_notes=body.minimisation_notes,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req.to_dict()


@router.get("/caldicott/{req_id}")
def get_request(
    req_id: int,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    req = db.query(CaldicottRequest).filter(
        CaldicottRequest.id == req_id,
        CaldicottRequest.clinic_id == cid,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return {**req.to_dict(), "principle_definitions": CALDICOTT_PRINCIPLES}


@router.post("/caldicott/{req_id}/decide")
def decide(
    req_id: int,
    body: CaldicottDecision,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    req = db.query(CaldicottRequest).filter(
        CaldicottRequest.id == req_id,
        CaldicottRequest.clinic_id == cid,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if body.decision not in ("approved", "rejected", "deferred"):
        raise HTTPException(status_code=400, detail="decision must be approved | rejected | deferred")
    req.status = body.decision
    req.decision_notes = body.notes
    req.decided_at = datetime.utcnow()
    req.guardian_id = user.id
    req.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return req.to_dict()


@router.get("/principles")
def get_principles():
    return CALDICOTT_PRINCIPLES


@router.get("/request-types")
def get_request_types():
    return REQUEST_TYPES


# ── DSPT checklist endpoints ──────────────────────────────────────────────────

@router.get("/dspt")
def get_dspt(
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    row = db.query(DsptChecklist).filter(DsptChecklist.clinic_id == cid).first()
    if not row:
        # Return template
        return {
            "clinic_id": cid,
            "year": "2025-26",
            "standards": {s["id"]: {"title": s["title"], "description": s["description"], "status": "not-started", "evidence": None, "notes": None} for s in DSPT_STANDARDS},
            "overall_status": "not-started",
            "submitted_at": None,
        }
    base = row.to_dict()
    # Merge static standard metadata
    merged = {}
    stds = base.get("standards", {})
    for s in DSPT_STANDARDS:
        merged[s["id"]] = {**s, **(stds.get(s["id"]) or {})}
    base["standards"] = merged
    return base


@router.patch("/dspt")
def update_dspt_standard(
    body: DsptUpdate,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    row = db.query(DsptChecklist).filter(DsptChecklist.clinic_id == cid).first()
    if not row:
        row = DsptChecklist(clinic_id=cid, standards=json.dumps({}))
        db.add(row)

    stds = {}
    if row.standards:
        try:
            stds = json.loads(row.standards)
        except Exception:
            pass

    stds[body.standard_id] = {
        "status": body.status,
        "evidence": body.evidence,
        "notes": body.notes,
    }
    row.standards = json.dumps(stds)

    # Recalculate overall status
    all_vals = [v.get("status") for v in stds.values()]
    met_count = sum(1 for v in all_vals if v == "met")
    if met_count == len(DSPT_STANDARDS):
        row.overall_status = "standards-met"
    elif met_count > 0:
        row.overall_status = "in-progress"

    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    # Return the merged view inline (same logic as get_dspt)
    base = row.to_dict()
    merged_stds = {}
    row_stds = base.get("standards", {})
    for s in DSPT_STANDARDS:
        merged_stds[s["id"]] = {**s, **(row_stds.get(s["id"]) or {})}
    base["standards"] = merged_stds
    return base


@router.post("/dspt/submit")
def submit_dspt(
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    cid = effective_clinic_id(user)
    row = db.query(DsptChecklist).filter(DsptChecklist.clinic_id == cid).first()
    if not row:
        raise HTTPException(status_code=400, detail="No DSPT checklist found — complete standards first")
    row.submitted_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "submitted", "submitted_at": row.submitted_at.isoformat()}
