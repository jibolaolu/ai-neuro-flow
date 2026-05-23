from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.user import UserRecord
from app.services.tenant import clients_query, effective_clinic_id
from app.services.ai_service import AIService

router = APIRouter()
service = AIService()


@router.get("/summary")
def get_report_summary() -> dict[str, str]:
    return {"summary": service.generate_report_summary("Initial intake notes")}


@router.get("/operational-overview", response_model=dict)
def operational_overview(
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Pathway counts from live clients + per-clinician assignment/completion metrics."""
    clients = clients_query(db, actor).all()
    pathway_counts: dict[str, int] = {}
    for c in clients:
        key = c.pathway or "Unspecified"
        pathway_counts[key] = pathway_counts.get(key, 0) + 1

    cq = db.query(UserRecord).filter(
        UserRecord.role.in_(("clinician", "senior-clinician")),
        UserRecord.is_active == True,  # noqa: E712
    )
    cid = effective_clinic_id(actor)
    if cid is not None:
        cq = cq.filter(UserRecord.clinic_id == cid)
    clinicians = cq.order_by(UserRecord.full_name).all()

    def _lower(s: str | None) -> str:
        return (s or "").lower()

    clinician_rows: list[dict] = []
    for u in clinicians:
        assigned = clients_query(db, actor).filter(ClientRecord.assigned_clinician_user_id == u.id).all()
        active_cases = sum(
            1
            for c in assigned
            if "complete" not in _lower(c.status) and "complete" not in _lower(c.stage)
        )
        completed = sum(
            1 for c in assigned if "complete" in _lower(c.status) or "complete" in _lower(c.stage)
        )
        booked_sessions = sum(1 for c in assigned if c.confirmed_session_at is not None)
        clinician_rows.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "active_cases": active_cases,
                "booked_sessions": booked_sessions,
                "completed_assessments": completed,
                "total_assigned": len(assigned),
            }
        )

    open_assessments = (
        clients_query(db, actor).filter(~func.lower(ClientRecord.status).contains("complete")).count()
    )

    return {
        "pathway_counts": [{"pathway": k, "clients": v} for k, v in sorted(pathway_counts.items())],
        "clinicians": clinician_rows,
        "totals": {
            "clients": len(clients),
            "open_assessments": open_assessments,
            "active_clinicians": len(clinicians),
        },
    }
