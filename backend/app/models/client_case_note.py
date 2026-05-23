"""Timestamped case notes visible to clinical admins and assigned clinicians."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class ClientCaseNoteRecord(Base):
    __tablename__ = "client_case_notes"

    id = Column(String, primary_key=True)
    client_id = Column(String, nullable=False, index=True)
    author_user_id = Column(String, nullable=False)
    author_name = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CaseNoteOut(BaseModel):
    id: str
    client_id: str
    author_user_id: str
    author_name: str
    body: str
    created_at: datetime | None

    class Config:
        from_attributes = True


class CaseNoteCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)


class CaseNoteList(BaseModel):
    items: list[CaseNoteOut]
    total: int
