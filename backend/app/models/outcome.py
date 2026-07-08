"""Post-assessment outcome tracking."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class OutcomeRecord(Base):
    __tablename__ = "client_outcomes"

    id                = Column(String, primary_key=True)
    client_id         = Column(String, nullable=False, index=True)
    clinic_id         = Column(String, nullable=True, index=True)
    assessment_id     = Column(String, nullable=True)
    recorded_by       = Column(String, nullable=True)   # user_id
    recorded_by_name  = Column(String, nullable=True)
    # Outcome fields
    final_diagnosis   = Column(String, nullable=True)
    treatment_plan    = Column(Text, nullable=True)
    referrals_made    = Column(Text, nullable=True)      # JSON list
    follow_up_date    = Column(String, nullable=True)    # YYYY-MM-DD
    client_feedback   = Column(Text, nullable=True)
    outcome_score     = Column(String, nullable=True)    # clinician-rated 1-5
    notes             = Column(Text, nullable=True)
    # AI prediction (generated at record time)
    ai_prediction     = Column(Text, nullable=True)      # JSON
    created_at        = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at        = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                               onupdate=lambda: datetime.now(timezone.utc))


class OutcomeOut(BaseModel):
    id:               str
    client_id:        str
    clinic_id:        str | None
    assessment_id:    str | None
    recorded_by:      str | None
    recorded_by_name: str | None
    final_diagnosis:  str | None
    treatment_plan:   str | None
    referrals_made:   str | None
    follow_up_date:   str | None
    client_feedback:  str | None
    outcome_score:    str | None
    notes:            str | None
    ai_prediction:    str | None
    created_at:       datetime | None
    updated_at:       datetime | None

    class Config:
        from_attributes = True


class OutcomeCreate(BaseModel):
    final_diagnosis:  str | None = None
    treatment_plan:   str | None = None
    referrals_made:   list[str] = []
    follow_up_date:   str | None = None
    client_feedback:  str | None = None
    outcome_score:    str | None = None
    notes:            str | None = Field(None, max_length=10000)


class OutcomeList(BaseModel):
    items: list[OutcomeOut]
    total: int
