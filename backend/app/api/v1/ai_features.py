"""
AI feature endpoints.

Permissions:
  - report-writing assistant: clinician, senior-clinician, clinical-admin
  - cross-informant synthesis: clinician, senior-clinician, clinical-admin
  - risk stratification: clinician, senior-clinician, clinical-admin
  - SOAP notes: clinician, senior-clinician
  - pre-submission QA: clinician, senior-clinician, clinical-admin
  - document auto-populate: clinician, senior-clinician, clinical-admin
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai.llm_gateway import llm_gateway
from app.api.deps import get_db, require_roles
from app.models.client_profile import ClientProfileRecord
from app.models.clinician_availability import ClinicianAvailabilitySlotRecord
from app.models.form_token import FormToken, STATUS_PENDING
from app.models.user import UserRecord
from app.services.document_intelligence import document_intelligence
from app.services.tenant import effective_clinic_id, get_client_for_user

logger = logging.getLogger(__name__)
router = APIRouter(redirect_slashes=False)

_CLINICAL_ROLES = ("clinician", "senior-clinician", "clinical-admin", "clinic-admin")
_REPORT_SECTIONS_CHECKLIST = [
    "Reason for Referral",
    "Background and History",
    "Assessment Method",
    "Results and Interpretation",
    "Diagnostic Impression",
    "Recommendations",
    "Summary",
]


# ── Request / response schemas ────────────────────────────────────────────────

class ReportSectionRequest(BaseModel):
    client_id:    str
    section_name: str
    case_notes:   str = ""

class SOAPRequest(BaseModel):
    client_id: str
    context:   str

class QARequest(BaseModel):
    client_id:   str
    report_text: str

class SynthesisRequest(BaseModel):
    client_id: str

class RiskRequest(BaseModel):
    client_id:  str
    case_notes: str = ""

class DocAutoPopulateRequest(BaseModel):
    client_id:      str
    report_section: str

class SafeguardingCheckRequest(BaseModel):
    text: str

class DiagnosticSupportRequest(BaseModel):
    client_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

# Tier-1 safeguarding keywords split by concern category
_SAFEGUARDING_PATTERNS = {
    "self-harm":    r"\b(self[-\s]?harm|cut(?:ting)?\s+(?:myself|self)|suicid|overdos|kill(?:ing)?\s+(?:myself|self)|want(?:ed|s)?\s+to\s+die|end(?:ing)?\s+(?:my|their)\s+life)\b",
    "abuse":        r"\b(abus(?:e|ed|ing|ive)|neglect(?:ed)?|assault(?:ed)?|sexual(?:ly)?\s+abus|domestic\s+violence|DV\b|exploitation|grooming)\b",
    "harm-to-others": r"\b(harm(?:ing)?\s+(?:others|someone|them)|violen(?:t|ce)(?:\s+toward|\s+to)?|threaten(?:ed|ing)|weapon|knife|attack(?:ing)?)\b",
    "substance":    r"\b(drug\s+use|substance\s+mis(?:use|using)|alcohol\s+problem|cannabis|cocaine|heroin|addiction)\b",
    "welfare":      r"\b(no\s+food|homeless|unsafe\s+(?:home|environment)|carers?\s+(?:missing|absent)|alone\s+(?:all\s+day|overnight))\b",
}


@router.post("/safeguarding-check")
def safeguarding_check(
    req: SafeguardingCheckRequest,
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
) -> dict:
    """
    Fast pattern-match scan of clinical text for safeguarding indicators.
    Returns a list of flags with category and matched excerpt.
    """
    import re
    flags = []
    text_lower = req.text
    for category, pattern in _SAFEGUARDING_PATTERNS.items():
        for m in re.finditer(pattern, text_lower, re.IGNORECASE):
            start = max(0, m.start() - 40)
            end   = min(len(req.text), m.end() + 40)
            flags.append({
                "category": category,
                "match":    m.group(),
                "excerpt":  "…" + req.text[start:end].strip() + "…",
            })
    severity = "none"
    if flags:
        cats = {f["category"] for f in flags}
        if "self-harm" in cats or "harm-to-others" in cats:
            severity = "high"
        elif "abuse" in cats:
            severity = "medium"
        else:
            severity = "low"
    return {"severity": severity, "flags": flags, "flag_count": len(flags)}


@router.post("/diagnostic-support")
def diagnostic_support(
    req: DiagnosticSupportRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
) -> dict:
    """
    Analyse completed form scores for a client and suggest likely
    diagnostic direction with confidence level and recommended next steps.
    """
    client = get_client_for_user(db, user, req.client_id)
    profile = db.query(ClientProfileRecord).filter(
        ClientProfileRecord.client_id == req.client_id
    ).first()
    scores = json.loads(profile.scores or "{}") if profile else {}

    if not scores:
        return {
            "suggestion": None,
            "confidence": "low",
            "reasoning": "No completed assessment scores found for this client.",
            "next_steps": [],
        }

    prompt = (
        f"You are a senior ADHD/autism clinician reviewing assessment scores.\n"
        f"Patient: {client.full_name}, Pathway: {client.pathway or 'not specified'}\n"
        f"Completed assessment scores: {json.dumps(scores, indent=2)}\n\n"
        "Based on these scores, provide:\n"
        "1. A likely diagnostic direction (e.g. 'ADHD likely', 'Autism likely', "
        "'ADHD + Autism likely', 'Sub-threshold — further investigation needed', etc.)\n"
        "2. Confidence level: high / medium / low\n"
        "3. Brief clinical reasoning (2-3 sentences)\n"
        "4. 2-3 recommended next steps\n\n"
        "Respond as JSON: {suggestion, confidence, reasoning, next_steps: [...]}"
    )
    try:
        raw = llm_gateway.simple_completion(prompt=prompt, max_tokens=500)
        import re
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
    except Exception:  # noqa: BLE001
        pass

    return {
        "suggestion": None,
        "confidence": "low",
        "reasoning": "AI analysis unavailable. Please review scores manually.",
        "next_steps": ["Review score reports", "Consult clinical guidelines", "Discuss in supervision"],
    }

@router.post("/report-section")
def suggest_report_section(
    req: ReportSectionRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """AI drafts a report section based on scores, notes, and similar cases."""
    client = get_client_for_user(db, user, req.client_id)
    clinic_id = effective_clinic_id(user)
    profile = db.query(ClientProfileRecord).filter(
        ClientProfileRecord.client_id == req.client_id
    ).first()
    scores = json.loads(profile.scores or "{}") if profile else {}

    try:
        from app.ai.rag_engine import rag_engine
        similar = rag_engine.retrieve(
            f"{req.section_name} {client.pathway or 'ADHD'}",
            collection="clinical_documents",
            clinic_id=clinic_id,
            n_results=3,
        ).get("matches", [])

        draft = llm_gateway.suggest_report_section(
            section_name=req.section_name,
            scores=scores,
            case_notes=req.case_notes,
            similar_cases=similar,
        )
        return {"section": req.section_name, "draft": draft, "sources": len(similar)}
    except Exception as exc:
        logger.error("suggest_report_section failed: %s", exc)
        raise HTTPException(500, f"AI generation failed: {exc}") from exc


@router.post("/soap-notes")
def suggest_soap_notes(
    req: SOAPRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
):
    """AI-suggested SOAP note from clinical context."""
    get_client_for_user(db, user, req.client_id)  # access check

    try:
        result = llm_gateway.suggest_soap(req.context)
        return result
    except Exception as exc:
        logger.error("suggest_soap_notes failed: %s", exc)
        raise HTTPException(500, f"AI generation failed: {exc}") from exc


@router.post("/pre-submission-qa")
def pre_submission_qa(
    req: QARequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """AI reviews the report for missing sections, contradictions, and compliance."""
    get_client_for_user(db, req.client_id, user)

    try:
        result = llm_gateway.qa_review(req.report_text, _REPORT_SECTIONS_CHECKLIST)
        return result
    except Exception as exc:
        logger.error("pre_submission_qa failed: %s", exc)
        raise HTTPException(500, f"QA review failed: {exc}") from exc


@router.post("/cross-informant-synthesis")
def cross_informant_synthesis(
    req: SynthesisRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """AI analyses discrepancies between parent, teacher, and self-report scores."""
    client = get_client_for_user(db, user, req.client_id)
    profile = db.query(ClientProfileRecord).filter(
        ClientProfileRecord.client_id == req.client_id
    ).first()
    if not profile or not profile.scores:
        raise HTTPException(404, "No scores available for this client")

    scores = json.loads(profile.scores)
    context = (
        f"Client pathway: {client.pathway or 'Unknown'}\n"
        f"Age group: {client.age_group or 'Unknown'}\n\n"
        f"Scores by instrument:\n{json.dumps(scores, indent=2)}"
    )

    try:
        result = llm_gateway.analyse_discrepancy(context)
        return result
    except Exception as exc:
        logger.error("cross_informant_synthesis failed: %s", exc)
        raise HTTPException(500, f"Synthesis failed: {exc}") from exc


@router.post("/risk-stratification")
def risk_stratification(
    req: RiskRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """AI risk stratification across all instruments + case notes."""
    client = get_client_for_user(db, user, req.client_id)
    profile = db.query(ClientProfileRecord).filter(
        ClientProfileRecord.client_id == req.client_id
    ).first()
    scores = json.loads(profile.scores or "{}") if profile else {}

    context = (
        f"Pathway: {client.pathway or 'Unknown'}\n"
        f"Age group: {client.age_group or 'Unknown'}\n\n"
        f"Instrument scores:\n{json.dumps(scores, indent=2)}\n\n"
        f"Clinician notes:\n{req.case_notes or 'None provided'}"
    )

    try:
        result = llm_gateway.stratify_risk(context)
        result["client_id"] = req.client_id
        return result
    except Exception as exc:
        logger.error("risk_stratification failed: %s", exc)
        raise HTTPException(500, f"Stratification failed: {exc}") from exc


@router.post("/doc-auto-populate")
def doc_auto_populate(
    req: DocAutoPopulateRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """Auto-populate a report section from the client's uploaded documents."""
    get_client_for_user(db, req.client_id, user)
    clinic_id = effective_clinic_id(user) or ""

    try:
        draft = document_intelligence.auto_populate_report_fields(
            client_id=req.client_id,
            clinic_id=clinic_id,
            report_section=req.report_section,
        )
        return {"section": req.report_section, "draft": draft}
    except Exception as exc:
        logger.error("doc_auto_populate failed: %s", exc)
        raise HTTPException(500, f"Auto-populate failed: {exc}") from exc


@router.get("/search-documents")
def search_documents(
    client_id: str,
    q: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """Semantic search over a client's uploaded and indexed documents."""
    get_client_for_user(db, client_id, user)
    clinic_id = effective_clinic_id(user) or ""

    matches = document_intelligence.search_client_documents(
        q, client_id=client_id, clinic_id=clinic_id
    )
    return {"query": q, "matches": matches}


# ── Smart Scheduling ──────────────────────────────────────────────────────────

class SmartAssignRequest(BaseModel):
    client_id: str

@router.post("/smart-assign")
def smart_assign_clinician(
    req: SmartAssignRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinic-admin", "clinical-admin", "senior-clinician")),
):
    """AI-ranked clinician assignment based on specialization, caseload, and availability."""
    client = get_client_for_user(db, user, req.client_id)
    clinic_id = effective_clinic_id(user)

    # Build clinician roster from available slots in this clinic
    from app.models.client import ClientRecord
    from sqlalchemy import func as sa_func

    clinicians_q = (
        db.query(UserRecord)
        .filter(
            UserRecord.clinic_id == clinic_id,
            UserRecord.role.in_(("clinician", "senior-clinician")),
            UserRecord.is_active == True,  # noqa: E712
        )
        .all()
    )

    # Enrich with caseload counts
    clinician_data = []
    for c in clinicians_q:
        active_cases = db.query(ClientRecord).filter(
            ClientRecord.clinic_id == clinic_id,
            ClientRecord.assigned_clinician_user_id == c.id,
        ).filter(
            ~sa_func.lower(ClientRecord.status).contains("complete"),
            ~sa_func.lower(ClientRecord.status).contains("cancel"),
        ).count()

        available_slots = db.query(ClinicianAvailabilitySlotRecord).filter(
            ClinicianAvailabilitySlotRecord.user_id == c.id,
            ClinicianAvailabilitySlotRecord.rota_status == "confirmed",
            ClinicianAvailabilitySlotRecord.booked_client_id.is_(None),
        ).count()

        clinician_data.append({
            "clinician_id":    c.id,
            "name":            getattr(c, "full_name", None) or c.email,
            "role":            c.role,
            "active_caseload": active_cases,
            "open_slots":      available_slots,
            "specializations": getattr(c, "specializations", None) or client.pathway or "General",
        })

    if not clinician_data:
        raise HTTPException(404, "No active clinicians found in this clinic")

    try:
        result = llm_gateway.suggest_clinician_assignment(
            client_pathway=client.pathway or "ADHD",
            client_age_group=client.age_group or "Adult",
            clinicians=clinician_data,
        )
        return result
    except Exception as exc:
        logger.error("smart_assign failed: %s", exc)
        raise HTTPException(500, f"AI assignment failed: {exc}") from exc


# ── Adaptive Form Reminders (manual trigger) ──────────────────────────────────

@router.get("/form-reminder-analysis")
def form_reminder_analysis(
    client_id: str = Query(...),
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """
    AI analysis of whether pending forms for a client need a reminder now,
    or if the client is likely to complete without one.
    """
    from datetime import datetime, timezone
    get_client_for_user(db, user, client_id)

    pending_tokens = db.query(FormToken).filter(
        FormToken.client_id == client_id,
        FormToken.status == STATUS_PENDING,
    ).all()

    if not pending_tokens:
        return {"message": "No pending forms for this client", "analyses": []}

    now = datetime.now(timezone.utc)
    analyses = []
    for tok in pending_tokens:
        sent_at = tok.sent_at
        if sent_at and sent_at.tzinfo is None:
            from datetime import timezone as tz
            sent_at = sent_at.replace(tzinfo=tz.utc)
        days_since = (now - sent_at).days if sent_at else 0
        reminder_count = 1 if tok.reminder_sent_at else 0

        try:
            pred = llm_gateway.predict_form_completion(
                days_since_sent=days_since,
                reminder_count=reminder_count,
                pathway=tok.form_type or "Assessment",
                completion_rate=0.72,  # default clinic average
            )
            analyses.append({
                "token_id":              tok.id,
                "form_type":             tok.form_type,
                "days_since_sent":       days_since,
                "reminders_already_sent": reminder_count,
                **pred,
            })
        except Exception as exc:
            logger.warning("Form prediction failed for token %s: %s", tok.id, exc)
            analyses.append({"token_id": tok.id, "error": str(exc)})

    return {"client_id": client_id, "analyses": analyses}


# ── Client-Facing AI Chat ─────────────────────────────────────────────────────

class ClientChatRequest(BaseModel):
    token:   str   # form token for unauthenticated client access
    message: str

@router.post("/client-chat")
def client_chat(
    req: ClientChatRequest,
    db: Session = Depends(get_db),
):
    """
    Client-facing chatbot. Auth via form token (no account required).
    Clients can ask questions about their assessment journey.
    """
    from app.models.client import ClientRecord

    # Validate the form token
    tok = db.query(FormToken).filter(FormToken.token == req.token).first()
    if not tok:
        raise HTTPException(401, "Invalid or expired token")

    client = db.query(ClientRecord).filter(ClientRecord.id == tok.client_id).first()
    context = (
        f"Client pathway: {client.pathway or 'Not specified'}\n"
        f"Client status: {client.status or 'In assessment'}\n"
        f"Form type: {tok.form_type or 'Assessment form'}\n"
        f"Form status: {tok.status}\n"
    ) if client else f"Form type: {tok.form_type or 'Assessment form'}"

    try:
        reply = llm_gateway.client_chat(req.message, context)
        return {"reply": reply}
    except Exception as exc:
        logger.error("client_chat failed: %s", exc)
        raise HTTPException(500, "Unable to process your question right now. Please try again.")
