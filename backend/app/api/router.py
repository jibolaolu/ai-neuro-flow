from fastapi import APIRouter

from app.core.config import settings
from app.api.v1 import (
    ai_features,
    ai_jobs,
    analytics,
    api_keys,
    assessments,
    assignments,
    auth,
    availability,
    billing,
    bookings,
    calendar_export,
    checkout,
    clinical_reports,
    clinician_finance,
    clinicians,
    clients,
    compliance,
    consent,
    fhir,
    follow_up,
    forms,
    invoices,
    organizations,
    outcomes,
    public_booking,
    referrals,
    reports,
    subscriptions,
    support_tickets,
    system,
    team,
    emis_connect,
    ig_workflow,
    prescriptions,
    push,
    telehealth,
    triage,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(public_booking.router, prefix="/public", tags=["public"])
api_router.include_router(availability.router, prefix="/availability", tags=["availability"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(clinician_finance.router, prefix="/clinician-finance", tags=["clinician-finance"])
api_router.include_router(team.router, prefix="/team", tags=["team"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(clinicians.router, prefix="/clinicians", tags=["clinicians"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(forms.router, prefix="/forms", tags=["forms"])

# Demo / dev-only routes — not mounted in production
if not settings.is_production():
    api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
    api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
    api_router.include_router(api_keys.router, prefix="/api-keys", tags=["api-keys"])
    api_router.include_router(checkout.router, prefix="/checkout", tags=["checkout"])
api_router.include_router(clinical_reports.router, prefix="/clinical-reports", tags=["clinical-reports"])
api_router.include_router(consent.router, prefix="/consent", tags=["consent"])
api_router.include_router(support_tickets.router, prefix="/support-tickets", tags=["support-tickets"])
api_router.include_router(ai_features.router, prefix="/ai", tags=["ai"])
api_router.include_router(ai_jobs.router, prefix="/ai-jobs", tags=["ai-jobs"])
api_router.include_router(outcomes.router, prefix="/outcomes", tags=["outcomes"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(follow_up.router, prefix="/follow-up", tags=["follow-up"])
api_router.include_router(calendar_export.router, prefix="", tags=["calendar"])
api_router.include_router(referrals.router, prefix="/referrals", tags=["referrals"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(triage.router, prefix="/triage", tags=["triage"])
api_router.include_router(fhir.router, prefix="/fhir", tags=["fhir"])
api_router.include_router(compliance.router, prefix="/compliance", tags=["compliance"])
api_router.include_router(push.router, prefix="/push", tags=["push"])
api_router.include_router(prescriptions.router, prefix="/prescriptions", tags=["prescriptions"])
api_router.include_router(ig_workflow.router, prefix="/ig", tags=["ig-workflow"])
api_router.include_router(emis_connect.router, prefix="/nhs", tags=["nhs-emis"])
api_router.include_router(telehealth.router, prefix="/telehealth", tags=["telehealth"])
