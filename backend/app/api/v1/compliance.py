"""CQC / compliance reporting dashboard — audit trails, consent rates, turnaround times."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import UserRecord

router = APIRouter()


def _clinic_id(user: UserRecord) -> str:
    return user.clinic_id or user.organization_id or ""


@router.get("/dashboard")
def compliance_dashboard(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Aggregate compliance KPIs for the CQC dashboard."""
    from app.models.client import ClientRecord
    from app.models.form_token import FormToken
    from app.models.consent import ConsentRecord  # may not exist — graceful
    from app.models.client_case_note import ClientCaseNoteRecord

    clinic_id = _clinic_id(user)
    now = datetime.now(timezone.utc)
    window_30 = now - timedelta(days=30)
    window_90 = now - timedelta(days=90)

    # ── Clients ─────────────────────────────────────────────────────────────
    client_q = db.query(ClientRecord)
    if user.role != "super-platform-admin":
        client_q = client_q.filter(ClientRecord.clinic_id == clinic_id)
    clients = client_q.all()
    total_clients = len(clients)

    # ── Forms / consent proxy ───────────────────────────────────────────────
    form_q = db.query(FormToken)
    all_forms = form_q.all()
    if user.role != "super-platform-admin":
        client_ids = {c.id for c in clients}
        all_forms = [f for f in all_forms if f.client_id in client_ids]

    submitted = [f for f in all_forms if f.status == "submitted"]
    consent_rate = round(len(submitted) / len(all_forms) * 100, 1) if all_forms else 0.0

    # ── Report turnaround ───────────────────────────────────────────────────
    try:
        from app.models.clinical_report import ClinicalReportRecord
        report_q = db.query(ClinicalReportRecord)
        if user.role != "super-platform-admin":
            report_q = report_q.filter(ClinicalReportRecord.clinic_id == clinic_id)
        issued = [r for r in report_q.all() if r.issued_at and r.created_at]
        if issued:
            turnarounds = [(r.issued_at - r.created_at).days for r in issued]
            avg_turnaround = round(sum(turnarounds) / len(turnarounds), 1)
            max_turnaround = max(turnarounds)
        else:
            avg_turnaround = 0.0
            max_turnaround = 0
        total_reports_issued = len(issued)
    except Exception:  # noqa: BLE001
        avg_turnaround = 0.0
        max_turnaround = 0
        total_reports_issued = 0

    # ── Case notes / audit ──────────────────────────────────────────────────
    try:
        note_q = db.query(ClientCaseNoteRecord)
        if user.role != "super-platform-admin":
            client_ids_set = {c.id for c in clients}
            note_q = note_q.filter(ClientCaseNoteRecord.client_id.in_(client_ids_set))
        notes = note_q.all()
        notes_last_30 = [n for n in notes if n.created_at and n.created_at >= window_30]
        total_notes = len(notes)
        notes_30d = len(notes_last_30)
    except Exception:  # noqa: BLE001
        total_notes = 0
        notes_30d = 0

    # ── Safeguarding flags (from case note body keywords) ──────────────────
    import re
    _SG_PATTERN = re.compile(
        r'\b(self[-\s]?harm|suicid|crisis|safeguarding|abus|neglect|assault|harm\s+to\s+others)\b',
        re.IGNORECASE
    )
    try:
        sg_flagged = sum(
            1 for n in notes
            if n.body and _SG_PATTERN.search(n.body)
        )
    except Exception:  # noqa: BLE001
        sg_flagged = 0

    # ── Clients without assigned clinician ─────────────────────────────────
    unassigned = sum(1 for c in clients if not getattr(c, "assigned_clinician_user_id", None))

    # ── Outstanding consents >14 days ──────────────────────────────────────
    cutoff_14 = now - timedelta(days=14)
    overdue_forms = [
        f for f in all_forms
        if f.status != "submitted" and f.created_at and f.created_at < cutoff_14
    ]

    # ── Recent audit log (last 20 case note events as proxy) ───────────────
    recent_activity = [
        {
            "timestamp": n.created_at.isoformat() if n.created_at else None,
            "event":     "Case note recorded",
            "actor":     n.author_name or "Unknown",
            "client_id": n.client_id,
        }
        for n in sorted(notes, key=lambda x: x.created_at or datetime.min, reverse=True)[:20]
    ]

    return {
        "generated_at":         now.isoformat(),
        "period":               "All time (30-day notes window)",

        # Governance KPIs
        "total_clients":        total_clients,
        "consent_rate_pct":     consent_rate,
        "forms_outstanding":    len(overdue_forms),
        "avg_report_turnaround_days": avg_turnaround,
        "max_report_turnaround_days": max_turnaround,
        "total_reports_issued": total_reports_issued,

        # Safeguarding
        "safeguarding_flags_total": sg_flagged,
        "notes_total":          total_notes,
        "notes_last_30d":       notes_30d,

        # Operational
        "clients_unassigned":   unassigned,
        "overdue_consent_forms": len(overdue_forms),

        # Audit trail
        "recent_activity":      recent_activity,
    }


@router.get("/audit-trail")
def audit_trail(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Return most recent audit-trail events (case notes + form submissions)."""
    from app.models.client import ClientRecord
    from app.models.form_token import FormToken
    from app.models.client_case_note import ClientCaseNoteRecord

    clinic_id = _clinic_id(user)
    clients = db.query(ClientRecord)
    if user.role != "super-platform-admin":
        clients = clients.filter(ClientRecord.clinic_id == clinic_id)
    client_ids = {c.id for c in clients.all()}

    events: list[dict] = []

    # Case notes
    try:
        notes = db.query(ClientCaseNoteRecord).filter(
            ClientCaseNoteRecord.client_id.in_(client_ids)
        ).all()
        for n in notes:
            events.append({
                "timestamp": n.created_at.isoformat() if n.created_at else None,
                "event_type": "case_note",
                "description": "Case note recorded",
                "actor": n.author_name or "Unknown",
                "client_id": n.client_id,
            })
    except Exception:  # noqa: BLE001
        pass

    # Form submissions
    try:
        forms = db.query(FormToken).filter(
            FormToken.client_id.in_(client_ids),
            FormToken.status == "submitted",
        ).all()
        for f in forms:
            events.append({
                "timestamp": f.submitted_at.isoformat() if getattr(f, "submitted_at", None) else None,
                "event_type": "form_submitted",
                "description": f"Form submitted: {f.form_type or 'Assessment form'}",
                "actor": "Client",
                "client_id": f.client_id,
            })
    except Exception:  # noqa: BLE001
        pass

    events.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    return {"events": events[:limit], "total": len(events)}
