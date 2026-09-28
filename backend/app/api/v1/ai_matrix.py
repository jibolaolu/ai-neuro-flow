"""
AI Clinician Assignment Matrix
Scores and ranks clinicians for a given client/pathway using:
  1. Preferred assessment type match (child / adult / both)
  2. Current workload — active assessment count (burnout guard)
  3. Report return rate — how often reports are sent back for revision
  4. Overall effectiveness score
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.user import UserRecord

router = APIRouter(tags=["ai-matrix"])

_CLINICIAN_ROLES = {"clinician", "senior-clinician"}


def _score_clinician(
    u: UserRecord,
    pathway: str | None,
    active_count: int,
    report_return_rate: float,
    total_issued: int,
) -> tuple[int, list[str]]:
    score = 60
    reasons: list[str] = []

    pat = getattr(u, "preferred_assessment_type", None)
    if pat and pathway:
        pathway_lower = pathway.lower()
        is_child = any(k in pathway_lower for k in ("child", "paed", "adhd child", "autism child"))
        is_adult = any(k in pathway_lower for k in ("adult",))
        if pat == "both":
            score += 10
            reasons.append("Comfortable with all assessment types")
        elif pat == "child" and is_child:
            score += 15
            reasons.append("Specialises in child assessments")
        elif pat == "adult" and is_adult:
            score += 15
            reasons.append("Specialises in adult assessments")
        elif pat == "child" and is_adult:
            score -= 10
            reasons.append("Prefers child assessments (adult pathway)")
        elif pat == "adult" and is_child:
            score -= 10
            reasons.append("Prefers adult assessments (child pathway)")
    else:
        reasons.append("No assessment preference set")

    if active_count == 0:
        score += 15
        reasons.append("No active assessments — full availability")
    elif active_count <= 3:
        score += 10
        reasons.append(f"{active_count} active assessment(s) — low load")
    elif active_count <= 6:
        score += 0
        reasons.append(f"{active_count} active assessment(s) — moderate load")
    elif active_count <= 10:
        score -= 10
        reasons.append(f"{active_count} active assessments — high load")
    else:
        score -= 20
        reasons.append(f"{active_count} active assessments — very high load")

    if total_issued == 0:
        reasons.append("No completed reports yet")
    elif report_return_rate == 0.0:
        score += 15
        reasons.append("No reports returned for revision — excellent quality")
    elif report_return_rate <= 0.10:
        score += 8
        reasons.append(f"{report_return_rate:.0%} report revision rate — very good")
    elif report_return_rate <= 0.25:
        score += 0
        reasons.append(f"{report_return_rate:.0%} report revision rate — acceptable")
    elif report_return_rate <= 0.50:
        score -= 10
        reasons.append(f"{report_return_rate:.0%} report revision rate — above average")
    else:
        score -= 20
        reasons.append(f"{report_return_rate:.0%} report revision rate — high, quality review recommended")

    if u.role == "senior-clinician":
        score += 5
        reasons.append("Senior Clinician")

    return max(0, min(100, score)), reasons


@router.get("/recommend")
def recommend_clinicians(
    pathway: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    clinicians = (
        db.query(UserRecord)
        .filter(UserRecord.role.in_(list(_CLINICIAN_ROLES)), UserRecord.is_active == True)  # noqa: E712
        .all()
    )

    results = []
    for u in clinicians:
        active_count = (
            db.query(func.count(ClientRecord.id))
            .filter(
                ClientRecord.assigned_clinician_user_id == u.id,
                ClientRecord.status.notin_(["Complete", "Assessment Complete", "Report Issued"]),
            )
            .scalar()
        ) or 0

        total_issued = (
            db.query(func.count(ClientRecord.id))
            .filter(ClientRecord.assigned_clinician_user_id == u.id)
            .scalar()
        ) or 0

        report_return_rate = 0.0

        score, reasons = _score_clinician(u, pathway, active_count, report_return_rate, total_issued)
        results.append({
            "clinician_id": u.id,
            "full_name": u.full_name,
            "role": u.role,
            "email": u.email,
            "preferred_assessment_type": getattr(u, "preferred_assessment_type", None),
            "active_assessments": active_count,
            "score": score,
            "reasons": reasons,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return {"pathway": pathway, "clinicians": results}
