"""
Platform analytics — real data from the database.

Replaces the hard-coded SUBSCRIBERS / REVENUE_MONTHS / PLATFORM_ALERTS
mock data in frontend/src/lib/super-admin-data.ts.

Permissions: super-platform-admin only.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import json

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.client_profile import ClientProfileRecord
from app.models.organization import OrganizationRecord
from app.models.support_ticket import SupportTicketRecord
from app.models.user import UserRecord

router = APIRouter(redirect_slashes=False)


def _plan_mrr(plan: str | None) -> int:
    """Map subscription plan name → monthly GBP value."""
    mapping = {"enterprise": 1200, "professional": 599, "starter": 299, "trial": 0}
    return mapping.get((plan or "").lower(), 0)


@router.get("/subscribers")
def get_subscribers(
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles("super-platform-admin")),
):
    """All registered organizations with live metrics from DB."""
    orgs = db.query(OrganizationRecord).order_by(OrganizationRecord.created_at.desc()).all()

    rows = []
    for org in orgs:
        # Count active users in this org
        active_users = db.query(UserRecord).filter(
            UserRecord.clinic_id == org.id,
            UserRecord.is_active == True,  # noqa: E712
        ).count()

        # Count open clients
        active_clients = db.query(ClientRecord).filter(
            ClientRecord.clinic_id == org.id,
        ).filter(
            ~func.lower(ClientRecord.status).contains("complete"),
            ~func.lower(ClientRecord.status).contains("cancel"),
        ).count()

        # Open support tickets
        open_tickets = db.query(SupportTicketRecord).filter(
            SupportTicketRecord.clinic_id == org.id,
            SupportTicketRecord.status.in_(("open", "in_progress", "awaiting_info")),
        ).count()

        # Reports this month (completed clients updated in last 30 days)
        month_ago = datetime.now(timezone.utc) - timedelta(days=30)

        plan   = org.subscription_plan or "professional"
        status = org.subscription_status or "trialing"
        # Normalise status labels (DB uses "trialing", UI expects "trial")
        ui_status = {
            "trialing": "trial",
            "active": "active",
            "past_due": "past_due",
            "canceled": "churned",
            "incomplete": "past_due",
        }.get(status, status)
        mrr = _plan_mrr(plan) if status == "active" else 0

        # Get admin email from users table
        admin_user = db.query(UserRecord).filter(
            UserRecord.clinic_id == org.id,
            UserRecord.role.in_(("clinic-admin", "clinical-admin", "admin")),
        ).first()
        contact_email = admin_user.email if admin_user else ""

        rows.append({
            "id":                   org.id,
            "name":                 org.name,
            "plan":                 plan,
            "status":               ui_status,
            "active_seats":         active_users,
            "active_clients":       active_clients,
            "mrr_gbp":              mrr,
            "open_support_tickets": open_tickets,
            "joined_date":          org.created_at.date().isoformat() if org.created_at else None,
            "contact_email":        contact_email,
        })

    total_mrr = sum(r["mrr_gbp"] for r in rows if r["status"] == "active")
    return {
        "subscribers": rows,
        "totals": {
            "total":     len(rows),
            "active":    sum(1 for r in rows if r["status"] == "active"),
            "trial":     sum(1 for r in rows if r["status"] == "trial"),
            "past_due":  sum(1 for r in rows if r["status"] == "past_due"),
            "churned":   sum(1 for r in rows if r["status"] in ("churned", "suspended")),
            "total_mrr": total_mrr,
        },
    }


@router.get("/revenue")
def get_revenue(
    months: int = 6,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles("super-platform-admin")),
):
    """MRR trend based on active organizations per month (approximation from join dates)."""
    # Build month buckets from (now - months) to now
    now = datetime.now(timezone.utc)
    buckets: list[dict] = []

    for i in range(months - 1, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        month_label = month_start.strftime("%Y-%m")

        # Count orgs that were active in this month (joined before end of month, not churned before start)
        month_end = month_start.replace(month=month_start.month % 12 + 1) if month_start.month < 12 \
            else month_start.replace(year=month_start.year + 1, month=1)

        active_orgs = db.query(OrganizationRecord).filter(
            OrganizationRecord.created_at <= month_end,
        ).all()

        mrr = sum(
            _plan_mrr(o.subscription_plan or "professional")
            for o in active_orgs
            if (o.subscription_status or "") == "active"
        )

        # New orgs this month
        new_orgs = [o for o in active_orgs if o.created_at >= month_start]
        new_mrr  = sum(_plan_mrr(getattr(o, "subscription_plan", "professional")) for o in new_orgs)

        buckets.append({
            "month":        month_label,
            "mrr_gbp":      mrr,
            "new_mrr":      new_mrr,
            "churned_mrr":  0,   # churn tracking requires subscription event log
            "expansion_mrr": 0,
        })

    return {"months": buckets}


@router.get("/platform-kpis")
def get_platform_kpis(
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles("super-platform-admin")),
):
    """Top-level KPIs for the super-admin dashboard header cards."""
    total_users   = db.query(UserRecord).filter(UserRecord.is_active == True).count()  # noqa: E712
    total_clients = db.query(ClientRecord).count()
    total_orgs    = db.query(OrganizationRecord).count()
    open_tickets  = db.query(SupportTicketRecord).filter(
        SupportTicketRecord.status.in_(("open", "in_progress"))
    ).count()

    orgs = db.query(OrganizationRecord).all()
    total_mrr = sum(
        _plan_mrr(o.subscription_plan or "professional")
        for o in orgs
        if (o.subscription_status or "") == "active"
    )

    return {
        "total_orgs":      total_orgs,
        "total_users":     total_users,
        "total_clients":   total_clients,
        "total_mrr_gbp":   total_mrr,
        "open_tickets":    open_tickets,
    }


@router.get("/population-insights")
def get_population_insights(
    clinic_id: str | None = None,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles("super-platform-admin", "clinic-admin", "clinical-admin")),
):
    """
    Population-level insights and benchmarking.
    Super-platform-admin sees cross-clinic aggregate; clinic-admin sees their clinic only.
    """
    from app.services.tenant import effective_clinic_id, is_platform_admin

    # Scope
    if is_platform_admin(user):
        scope_id = clinic_id  # optional filter for a specific clinic
    else:
        scope_id = effective_clinic_id(user)

    # Clients query
    cq = db.query(ClientRecord)
    if scope_id:
        cq = cq.filter(ClientRecord.clinic_id == scope_id)
    clients = cq.all()
    total = len(clients)
    if total == 0:
        return {"total_clients": 0, "pathways": {}, "status_distribution": {}, "benchmarks": {}}

    # Pathway distribution
    pathway_counts: dict[str, int] = {}
    for c in clients:
        p = c.pathway or "Unknown"
        pathway_counts[p] = pathway_counts.get(p, 0) + 1

    # Status distribution
    status_counts: dict[str, int] = {}
    for c in clients:
        s = c.status or "Unknown"
        status_counts[s] = status_counts.get(s, 0) + 1

    # Score statistics from profiles
    profiles = db.query(ClientProfileRecord).all()
    if scope_id:
        client_ids = {c.id for c in clients}
        profiles = [p for p in profiles if p.client_id in client_ids]

    score_totals: dict[str, list[float]] = {}
    for prof in profiles:
        if not prof.scores:
            continue
        try:
            scores = json.loads(prof.scores)
            for instrument, val in scores.items():
                if isinstance(val, (int, float)):
                    score_totals.setdefault(instrument, []).append(float(val))
        except Exception:
            pass

    benchmarks: dict[str, dict] = {}
    for instrument, vals in score_totals.items():
        if vals:
            avg = sum(vals) / len(vals)
            benchmarks[instrument] = {
                "n":   len(vals),
                "mean": round(avg, 1),
                "min":  round(min(vals), 1),
                "max":  round(max(vals), 1),
            }

    # Time to completion (clients with complete status)
    completed = [c for c in clients if c.status and "complete" in c.status.lower()]
    avg_days: float | None = None
    if completed:
        durations = []
        for c in completed:
            if c.created_at and c.confirmed_session_at:
                delta = (c.confirmed_session_at - c.created_at).days
                if delta >= 0:
                    durations.append(delta)
        if durations:
            avg_days = round(sum(durations) / len(durations), 1)

    return {
        "scope":               scope_id or "all_clinics",
        "total_clients":       total,
        "pathways":            pathway_counts,
        "status_distribution": status_counts,
        "benchmarks":          benchmarks,
        "avg_days_to_completion": avg_days,
        "completion_rate":     round(len(completed) / total * 100, 1) if total else 0,
    }
