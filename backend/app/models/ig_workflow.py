from __future__ import annotations
import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from app.db.base import Base


class CaldicottRequest(Base):
    """Caldicott guardian approval request for patient data disclosure / access."""
    __tablename__ = "caldicott_requests"

    id             = Column(Integer, primary_key=True, index=True)
    clinic_id      = Column(Integer, nullable=False, index=True)
    requester_id   = Column(Integer, nullable=True)   # user who raised the request
    guardian_id    = Column(Integer, nullable=True)   # assigned Caldicott guardian

    # Request details
    request_type   = Column(String(60), nullable=False)   # data-share | subject-access | third-party | research
    purpose        = Column(Text, nullable=False)
    data_described = Column(Text, nullable=False)         # what data will be shared
    recipients     = Column(Text, nullable=True)          # who receives the data
    legal_basis    = Column(String(200), nullable=True)   # e.g. GDPR Art 9(2)(h)

    # Caldicott principles assessment (7 principles, stored as JSON booleans)
    principles_met = Column(Text, nullable=True)  # JSON {1: bool, ..., 7: bool}

    # Data minimisation
    minimisation_applied = Column(Boolean, default=False)
    minimisation_notes   = Column(Text, nullable=True)

    # Decision
    status         = Column(String(30), default="pending")  # pending | approved | rejected | deferred
    decision_notes = Column(Text, nullable=True)
    decided_at     = Column(DateTime, nullable=True)

    # DSPT evidence links
    dspt_evidence  = Column(Text, nullable=True)  # JSON list of evidence items

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def principles(self) -> dict:
        if not self.principles_met:
            return {}
        try:
            return json.loads(self.principles_met)
        except Exception:
            return {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "clinic_id": self.clinic_id,
            "requester_id": self.requester_id,
            "guardian_id": self.guardian_id,
            "request_type": self.request_type,
            "purpose": self.purpose,
            "data_described": self.data_described,
            "recipients": self.recipients,
            "legal_basis": self.legal_basis,
            "principles_met": self.principles,
            "minimisation_applied": self.minimisation_applied,
            "minimisation_notes": self.minimisation_notes,
            "status": self.status,
            "decision_notes": self.decision_notes,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "dspt_evidence": json.loads(self.dspt_evidence) if self.dspt_evidence else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DsptChecklist(Base):
    """DSPT (Data Security & Protection Toolkit) annual evidence checklist per clinic."""
    __tablename__ = "dspt_checklists"

    id        = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, nullable=False, unique=True, index=True)
    year      = Column(String(10), nullable=False, default="2025-26")

    # 10 mandatory DSPT standards (stored as JSON completion status)
    standards = Column(Text, nullable=True)   # JSON {std_id: {status, evidence, notes}}
    overall_status = Column(String(30), default="not-started")  # not-started | in-progress | standards-met | exceeded

    submitted_at = Column(DateTime, nullable=True)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        stds = {}
        if self.standards:
            try:
                stds = json.loads(self.standards)
            except Exception:
                pass
        return {
            "id": self.id,
            "clinic_id": self.clinic_id,
            "year": self.year,
            "standards": stds,
            "overall_status": self.overall_status,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
        }
