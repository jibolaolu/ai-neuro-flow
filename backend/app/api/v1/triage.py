"""Waiting list triage & prioritisation — auto-scores referrals by clinical urgency."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.rtc_referral import (
    RTC_STATUS_PENDING,
    RTC_STATUS_ACCEPTED,
    RTCReferralRecord,
)
from app.models.user import UserRecord

router = APIRouter()

# ── Triage scoring weights ─────────────────────────────────────────────────────

_PATHWAY_COMPLEXITY: dict[str, int] = {
    "Adult ADHD + Autism":        15,
    "Child ADHD + Autism":        15,
    "Adolescent Autism":          12,
    "Child Autism":               12,
    "Adolescent ADHD":            10,
    "Child ADHD":                 10,
    "Adult Autism":               10,
    "Adult ADHD":                  5,
}

_CONCERN_KEYWORDS_HIGH = [
    "self-harm", "suicid", "crisis", "emergency", "safeguarding",
    "acute", "severe", "medication urgent", "school exclusion", "looked after",
]


def _compute_triage_score(referral: RTCReferralRecord, now: datetime) -> dict[str, Any]:
    score = 0
    flags: list[str] = []

    # Priority weight
    if referral.priority == "urgent":
        score += 50
        flags.append("Urgent referral")

    # Wait time (days since referral or creation)
    ref_date = referral.referred_date or referral.created_at
    wait_days = max(0, (now - ref_date.replace(tzinfo=timezone.utc)).days) if ref_date else 0
    score += min(wait_days, 60)           # cap at 60 to prevent domination
    if wait_days >= 42:
        flags.append(f"Waiting {wait_days}d — may breach 6-week standard")
    elif wait_days >= 28:
        flags.append(f"Waiting {wait_days}d")

    # Pathway complexity
    score += _PATHWAY_COMPLEXITY.get(referral.pathway, 5)

    # Presenting concerns keywords
    concerns = (referral.presenting_concerns or "").lower()
    matched = [kw for kw in _CONCERN_KEYWORDS_HIGH if kw in concerns]
    if matched:
        score += 30
        flags.append(f"High-concern keywords: {', '.join(matched[:3])}")

    # Missing referrer info degrades confidence
    missing: list[str] = []
    if not referral.patient_nhs_number:
        missing.append("NHS number")
    if not referral.gp_email and not referral.patient_email:
        missing.append("contact email")
    if missing:
        flags.append(f"Incomplete: {', '.join(missing)}")

    risk_level = "high" if score >= 80 else "medium" if score >= 45 else "low"

    return {
        "referral_id":      referral.id,
        "patient_name":     referral.patient_name,
        "pathway":          referral.pathway,
        "priority":         referral.priority,
        "status":           referral.status,
        "wait_days":        wait_days,
        "triage_score":     score,
        "risk_level":       risk_level,
        "flags":            flags,
        "gp_practice":      referral.gp_practice,
        "icb_name":         referral.icb_name,
        "referred_date":    referral.referred_date.isoformat() if referral.referred_date else None,
        "created_at":       referral.created_at.isoformat() if referral.created_at else None,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/")
def get_triage_list(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "senior-clinician"
    )),
) -> dict:
    """Return all pending/accepted referrals ranked by triage score (highest first)."""
    clinic_id = user.clinic_id or user.organization_id or ""
    q = db.query(RTCReferralRecord).filter(
        RTCReferralRecord.status.in_([RTC_STATUS_PENDING, RTC_STATUS_ACCEPTED])
    )
    if user.role != "super-platform-admin":
        q = q.filter(RTCReferralRecord.clinic_id == clinic_id)

    now = datetime.now(timezone.utc)
    scored = [_compute_triage_score(r, now) for r in q.all()]
    scored.sort(key=lambda x: x["triage_score"], reverse=True)

    high = [s for s in scored if s["risk_level"] == "high"]
    medium = [s for s in scored if s["risk_level"] == "medium"]
    low = [s for s in scored if s["risk_level"] == "low"]

    return {
        "items":          scored,
        "total":          len(scored),
        "high_risk":      len(high),
        "medium_risk":    len(medium),
        "low_risk":       len(low),
        "generated_at":   now.isoformat(),
    }


@router.get("/summary")
def get_triage_summary(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "senior-clinician"
    )),
) -> dict:
    """KPI summary for dashboard widgets."""
    clinic_id = user.clinic_id or user.organization_id or ""
    q = db.query(RTCReferralRecord).filter(
        RTCReferralRecord.status.in_([RTC_STATUS_PENDING, RTC_STATUS_ACCEPTED])
    )
    if user.role != "super-platform-admin":
        q = q.filter(RTCReferralRecord.clinic_id == clinic_id)

    now = datetime.now(timezone.utc)
    rows = q.all()
    scored = [_compute_triage_score(r, now) for r in rows]
    breach_risk = [s for s in scored if s["wait_days"] >= 42]
    avg_wait = sum(s["wait_days"] for s in scored) / len(scored) if scored else 0

    return {
        "total_waiting":          len(scored),
        "high_risk_count":        sum(1 for s in scored if s["risk_level"] == "high"),
        "breach_risk_count":      len(breach_risk),
        "avg_wait_days":          round(avg_wait, 1),
        "longest_wait_days":      max((s["wait_days"] for s in scored), default=0),
    }
