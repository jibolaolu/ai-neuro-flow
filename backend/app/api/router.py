from fastapi import APIRouter

from app.core.config import settings
from app.api.v1 import (
    api_keys,
    assessments,
    assignments,
    auth,
    availability,
    billing,
    bookings,
    checkout,
    clinical_reports,
    clinician_finance,
    clinicians,
    clients,
    consent,
    forms,
    organizations,
    public_booking,
    reports,
    subscriptions,
    support_tickets,
    system,
    team,
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
