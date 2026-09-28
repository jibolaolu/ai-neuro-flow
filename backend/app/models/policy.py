"""Policy library model."""
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.base import Base

VISIBILITY_ADMIN_ONLY = "admin_only"
VISIBILITY_SENIOR_UP = "senior_up"
VISIBILITY_ALL_STAFF = "all_staff"

ROLES_BY_VISIBILITY: dict[str, set[str]] = {
    VISIBILITY_ADMIN_ONLY: {"clinical-admin", "super-platform-admin"},
    VISIBILITY_SENIOR_UP: {"senior-clinician", "clinical-admin", "super-platform-admin"},
    VISIBILITY_ALL_STAFF: {"clinician", "senior-clinician", "clinical-admin", "super-platform-admin"},
}


class PolicyRecord(Base):
    __tablename__ = "policies"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    visibility = Column(String, default=VISIBILITY_ALL_STAFF)
    content = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    version = Column(String, nullable=True, default="1.0")
    review_date = Column(String, nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    created_by_user_id = Column(String, nullable=True)
    created_by_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class PolicyOut(BaseModel):
    id: str
    title: str
    description: str | None = None
    category: str | None = None
    visibility: str
    content: str | None = None
    file_name: str | None = None
    file_type: str | None = None
    version: str | None = None
    review_date: str | None = None
    is_ai_generated: bool = False
    created_by_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PolicyList(BaseModel):
    items: list[PolicyOut]
    total: int


class PolicyCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    visibility: str = VISIBILITY_ALL_STAFF
    content: str | None = None
    version: str | None = "1.0"
    review_date: str | None = None


class PolicyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    visibility: str | None = None
    content: str | None = None
    version: str | None = None
    review_date: str | None = None


class PolicyGenerateRequest(BaseModel):
    title: str
    category: str | None = None
    visibility: str = VISIBILITY_ALL_STAFF
    context: str | None = None
