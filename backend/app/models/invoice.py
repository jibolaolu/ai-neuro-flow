"""Clinic invoice model (client-facing billing)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, String, Text

from app.db.base import Base

INV_STATUS_DRAFT    = "draft"
INV_STATUS_SENT     = "sent"
INV_STATUS_PAID     = "paid"
INV_STATUS_OVERDUE  = "overdue"
INV_STATUS_VOID     = "void"


class InvoiceRecord(Base):
    __tablename__ = "invoices"

    id                      = Column(String, primary_key=True,
                                     default=lambda: f"INV-{uuid.uuid4().hex[:8].upper()}")
    clinic_id               = Column(String, nullable=False, index=True)

    # Client
    client_id               = Column(String, nullable=True, index=True)
    client_name             = Column(String, nullable=False)
    client_email            = Column(String, nullable=False)

    # Invoice
    invoice_number          = Column(String, nullable=True)       # human-friendly e.g. "2026-0042"
    description             = Column(Text, nullable=False)
    line_items_json         = Column(Text, nullable=True)         # JSON list of {desc, qty, unit_gbp}
    amount_gbp              = Column(Float, nullable=False)
    vat_rate                = Column(Float, nullable=False, default=0.0)  # 0.0 or 0.20

    # Status
    status                  = Column(String, nullable=False, default=INV_STATUS_DRAFT)

    # Stripe
    stripe_payment_link     = Column(String, nullable=True)
    stripe_price_id         = Column(String, nullable=True)
    stripe_payment_intent   = Column(String, nullable=True)

    # Dates
    invoice_date            = Column(DateTime, nullable=False,
                                     default=lambda: datetime.now(timezone.utc))
    due_date                = Column(DateTime, nullable=True)
    sent_at                 = Column(DateTime, nullable=True)
    paid_at                 = Column(DateTime, nullable=True)
    created_at              = Column(DateTime, nullable=False,
                                     default=lambda: datetime.now(timezone.utc))
    created_by              = Column(String, nullable=True)
    notes                   = Column(Text, nullable=True)

    @property
    def total_gbp(self) -> float:
        return round(self.amount_gbp * (1 + self.vat_rate), 2)

    def to_dict(self) -> dict:
        return {
            "id":                   self.id,
            "clinic_id":            self.clinic_id,
            "client_id":            self.client_id,
            "client_name":          self.client_name,
            "client_email":         self.client_email,
            "invoice_number":       self.invoice_number,
            "description":          self.description,
            "amount_gbp":           self.amount_gbp,
            "vat_rate":             self.vat_rate,
            "total_gbp":            self.total_gbp,
            "status":               self.status,
            "stripe_payment_link":  self.stripe_payment_link,
            "invoice_date":         self.invoice_date.isoformat() if self.invoice_date else None,
            "due_date":             self.due_date.isoformat() if self.due_date else None,
            "sent_at":              self.sent_at.isoformat() if self.sent_at else None,
            "paid_at":              self.paid_at.isoformat() if self.paid_at else None,
            "created_at":           self.created_at.isoformat() if self.created_at else None,
            "notes":                self.notes,
        }
