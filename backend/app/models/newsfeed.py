"""Staff newsfeed model."""

import json
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.db.base import Base


class NewsfeedPost(Base):
    __tablename__ = "newsfeed_posts"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    author_id = Column(String, nullable=False, index=True)
    author_name = Column(String, nullable=False)
    visibility = Column(String, default="all_staff")
    pinned = Column(Boolean, default=False)
    image_urls = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class NewsfeedPostOut(BaseModel):
    id: str
    title: str
    body: str
    author_name: str
    visibility: str
    pinned: bool = False
    image_urls: list[str] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("image_urls", mode="before")
    @classmethod
    def parse_image_urls(cls, v: object) -> list[str]:
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


class NewsfeedList(BaseModel):
    items: list[NewsfeedPostOut]
    total: int


class NewsfeedCreate(BaseModel):
    title: str
    body: str
    visibility: str = "all_staff"
    pinned: bool = False
    image_urls: list[str] = []


class NewsfeedUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    visibility: str | None = None
    pinned: bool | None = None
    image_urls: list[str] | None = None
