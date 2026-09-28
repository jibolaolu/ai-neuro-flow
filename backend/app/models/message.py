"""Direct messaging model between admin and clinical staff."""
import json
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.base import Base


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(String, primary_key=True)
    sender_id = Column(String, nullable=False, index=True)
    sender_name = Column(String, nullable=False)
    sender_role = Column(String, nullable=False)
    recipient_id = Column(String, nullable=False, index=True)
    recipient_name = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    parent_id = Column(String, nullable=True, index=True)
    is_read = Column(Boolean, default=False)
    attachment_urls = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class MessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_role: str
    recipient_id: str
    recipient_name: str
    subject: str | None = None
    body: str
    parent_id: str | None = None
    is_read: bool = False
    attachment_urls: list[str] = []
    created_at: datetime | None = None

    @field_validator("attachment_urls", mode="before")
    @classmethod
    def parse_attachment_urls(cls, v: object) -> list[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return []

    model_config = ConfigDict(from_attributes=True)


class MessageList(BaseModel):
    items: list[MessageOut]
    total: int
    unread: int


class MessageSend(BaseModel):
    recipient_id: str
    subject: str | None = None
    body: str
    parent_id: str | None = None
    attachment_urls: list[str] = []
