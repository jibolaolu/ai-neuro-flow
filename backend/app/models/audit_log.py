"""Immutable audit trail for sensitive admin actions."""

from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False, index=True)
    actor_user_id = Column(String, nullable=True, index=True)
    actor_name = Column(String, nullable=True)
    actor_email = Column(String, nullable=True)
    target_type = Column(String, nullable=True)
    target_id = Column(String, nullable=True, index=True)
    target_name = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class AuditLogOut(BaseModel):
    id: str
    event_type: str
    actor_user_id: str | None
    actor_name: str | None
    actor_email: str | None
    target_type: str | None
    target_id: str | None
    target_name: str | None
    detail: str | None
    created_at: str | None

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    items: list[AuditLogOut]
    total: int
