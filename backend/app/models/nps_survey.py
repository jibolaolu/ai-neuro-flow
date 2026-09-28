"""NPS satisfaction survey model — CQC requirement."""

import secrets
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.base import Base


class NpsSurveyRecord(Base):
    __tablename__ = "nps_surveys"

    id = Column(String, primary_key=True)
    token = Column(String, unique=True, nullable=False, index=True)
    client_id = Column(String, nullable=False, index=True)
    nps_score = Column(Integer, nullable=True)
    satisfaction_score = Column(Integer, nullable=True)
    communication_score = Column(Integer, nullable=True)
    report_quality_score = Column(Integer, nullable=True)
    free_text = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def generate_survey_token() -> str:
    return secrets.token_urlsafe(32)


class SurveySubmitBody(BaseModel):
    nps_score: int
    satisfaction_score: int
    communication_score: int
    report_quality_score: int
    free_text: str = ""


class SurveyOut(BaseModel):
    id: str
    client_id: str
    nps_score: int | None
    satisfaction_score: int | None
    communication_score: int | None
    report_quality_score: int | None
    free_text: str | None
    submitted_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
