from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String

from app.db.base import Base


class ClientDocumentRecord(Base):
    __tablename__ = "client_documents"

    id = Column(String, primary_key=True)
    client_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    stored_rel_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    uploaded_by_user_id = Column(String, nullable=False)
    uploaded_by_name = Column(String, nullable=False)
    audience = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ClientDocumentOut(BaseModel):
    id: str
    client_id: str
    title: str
    document_type: str
    file_type: str
    size_bytes: int
    uploaded_at: datetime | None
    uploaded_by: str
    audience: str

    model_config = {"from_attributes": True}


class ClientDocumentList(BaseModel):
    items: list[ClientDocumentOut]
    total: int
