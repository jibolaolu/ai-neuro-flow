"""
PendingCheckout stores the client's form details BEFORE Stripe payment.

Flow:
  1. WordPress order-summary page calls POST /api/v1/checkout/pre-payment
     with all client details (including child DOB for under-18 bookings).
  2. Backend persists a PendingCheckout and returns a short pending_id.
  3. WordPress redirects to Stripe Payment Link with
     ?client_reference_id={pending_id}&prefilled_email={email}
  4. On checkout.session.completed the Stripe webhook fetches the
     PendingCheckout by pending_id and uses the stored child_dob to
     determine the exact age group (Child / Adolescent / Adult).
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, Column, DateTime, String

from app.db.base import Base


class PendingCheckout(Base):
    __tablename__ = "pending_checkouts"

    id = Column(String, primary_key=True)          # PC-XXXXXXXX

    # Parent / client details
    first_name    = Column(String, nullable=True)
    last_name     = Column(String, nullable=True)
    email         = Column(String, nullable=False, index=True)
    phone         = Column(String, nullable=True)
    dob           = Column(String, nullable=True)  # parent/client DOB (DD/MM/YYYY from form)
    address       = Column(String, nullable=True)  # comma-joined address parts

    # Service
    service_key   = Column(String, nullable=True)  # e.g. "child-virtual"

    # Child fields (only populated when for_child=True)
    for_child       = Column(Boolean, default=False)
    child_first_name = Column(String, nullable=True)
    child_last_name  = Column(String, nullable=True)
    child_dob        = Column(String, nullable=True)  # ISO YYYY-MM-DD

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(hours=24))
