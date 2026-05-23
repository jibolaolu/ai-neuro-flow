import secrets
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, Text

from app.db.base import Base

# Form types
FORM_BASIC_INTAKE = "basic_intake"
FORM_ADULT_SELF = "adult_self"
FORM_ADULT_GP = "adult_gp"
FORM_ADOLESCENT_SELF = "adolescent_self"
FORM_ADOLESCENT_GP = "adolescent_gp"
FORM_ADOLESCENT_TEACHER = "adolescent_teacher"
FORM_CHILD_PARENT = "child_parent"
FORM_CHILD_TEACHER = "child_teacher"
FORM_CHILD_GP = "child_gp"

FORM_TYPE_LABELS = {
    FORM_BASIC_INTAKE: "Client information (Neuro Flow)",
    FORM_ADULT_SELF: "Adult ADHD/Autism Self-Report",
    FORM_ADULT_GP: "GP Information Request (Adult)",
    FORM_ADOLESCENT_SELF: "Adolescent ADHD/Autism Parent/Self-Report (11–18)",
    FORM_ADOLESCENT_GP: "GP Information Request (Adolescent)",
    FORM_ADOLESCENT_TEACHER: "Conners' Teacher Rating Scale (Adolescent)",
    FORM_CHILD_PARENT: "Child Assessment Parent/Guardian Pack (5–10)",
    FORM_CHILD_TEACHER: "Conners Teacher Rating Scale",
    FORM_CHILD_GP: "GP Information Request (Child)",
}

# Status values
STATUS_PENDING = "pending"
STATUS_SUBMITTED = "submitted"
STATUS_REMINDED = "reminded"


def generate_token() -> str:
    return secrets.token_urlsafe(32)


class FormToken(Base):
    __tablename__ = "form_tokens"

    id = Column(String, primary_key=True)
    token = Column(String, unique=True, nullable=False, index=True)
    client_id = Column(String, nullable=False, index=True)
    form_type = Column(String, nullable=False)
    recipient_email = Column(String, nullable=False)
    recipient_name = Column(String, nullable=True)
    status = Column(String, default=STATUS_PENDING)
    responses = Column(Text, nullable=True)           # JSON string
    sent_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    reminder_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# Pydantic schemas

class FormInfo(BaseModel):
    token: str
    form_type: str
    form_label: str
    client_name: str
    recipient_name: str | None = None
    status: str

    class Config:
        from_attributes = True


class FormTokenOut(BaseModel):
    id: str
    token: str
    form_type: str
    form_label: str
    recipient_email: str
    recipient_name: str | None
    status: str
    sent_at: datetime | None
    submitted_at: datetime | None

    class Config:
        from_attributes = True
