from __future__ import annotations
import json
from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Float, Boolean, ForeignKey
from app.db.base import Base


class PrescriptionRecord(Base):
    __tablename__ = "prescriptions"

    id            = Column(Integer, primary_key=True, index=True)
    clinic_id     = Column(Integer, nullable=False, index=True)
    client_id     = Column(Integer, nullable=False, index=True)
    prescriber_id = Column(Integer, nullable=True)

    # Medication
    medication        = Column(String(200), nullable=False)
    formulation       = Column(String(100), nullable=True)   # e.g. "modified-release capsule"
    dose_mg           = Column(Float, nullable=True)
    frequency         = Column(String(100), nullable=True)   # e.g. "once daily"
    route             = Column(String(50),  default="oral")
    indication        = Column(String(200), nullable=True)   # e.g. "ADHD — inattentive type"

    # Titration
    titration_phase   = Column(Integer, default=1)           # 1 = starting dose
    titration_plan    = Column(Text, nullable=True)          # JSON: [{phase, dose_mg, duration_weeks, notes}]
    titration_notes   = Column(Text, nullable=True)

    # Dates
    start_date        = Column(Date, nullable=True)
    review_date       = Column(Date, nullable=True)
    end_date          = Column(Date, nullable=True)

    # Status
    status            = Column(String(30), default="active")  # active | on-hold | stopped | completed
    stop_reason       = Column(Text, nullable=True)

    # Shared care
    shared_care_requested = Column(Boolean, default=False)
    shared_care_gp_name   = Column(String(200), nullable=True)
    shared_care_gp_email  = Column(String(200), nullable=True)
    shared_care_sent_at   = Column(DateTime, nullable=True)

    # Monitoring
    monitoring_notes  = Column(Text, nullable=True)
    side_effects      = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def titration_steps(self) -> list:
        if not self.titration_plan:
            return []
        try:
            return json.loads(self.titration_plan)
        except Exception:
            return []

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "prescriber_id": self.prescriber_id,
            "medication": self.medication,
            "formulation": self.formulation,
            "dose_mg": self.dose_mg,
            "frequency": self.frequency,
            "route": self.route,
            "indication": self.indication,
            "titration_phase": self.titration_phase,
            "titration_steps": self.titration_steps,
            "titration_notes": self.titration_notes,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "review_date": self.review_date.isoformat() if self.review_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "stop_reason": self.stop_reason,
            "shared_care_requested": self.shared_care_requested,
            "shared_care_gp_name": self.shared_care_gp_name,
            "shared_care_gp_email": self.shared_care_gp_email,
            "shared_care_sent_at": self.shared_care_sent_at.isoformat() if self.shared_care_sent_at else None,
            "monitoring_notes": self.monitoring_notes,
            "side_effects": self.side_effects,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
