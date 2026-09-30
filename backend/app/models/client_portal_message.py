"""Client-to-clinic messaging model."""

import secrets
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.base import Base


class ClientPortalMessage(Base):
    __tablename__ = "client_portal_messages"

    id = Column(
        String, primary_key=True, default=lambda: f"CPM-{secrets.token_hex(4).upper()}"
    )
    client_id = Column(String, nullable=False, index=True)
    direction = Column(String, nullable=False)
    sender_name = Column(String, nullable=False)
    sender_user_id = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ClientPortalMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    direction: str
    sender_name: str
    body: str
    is_read: bool
    created_at: datetime


class ClientPortalMessageSend(BaseModel):
    body: str


class ClientPortalMessageList(BaseModel):
    items: list[ClientPortalMessageOut]
    total: int
    unread: int
