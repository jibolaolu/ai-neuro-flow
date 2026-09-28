"""In-platform notification model."""

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, Column, DateTime, String

from app.db.base import Base


class NotificationRecord(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(String, nullable=True)
    client_id = Column(String, nullable=True)
    link = Column(String, nullable=True)
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str | None = None
    client_id: str | None = None
    link: str | None = None
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
