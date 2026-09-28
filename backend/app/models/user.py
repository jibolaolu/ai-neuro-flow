from enum import Enum

from pydantic import BaseModel
from sqlalchemy import Boolean, Column, String

from app.db.base import Base


class UserRole(str, Enum):
    super_platform_admin = "super-platform-admin"
    clinical_admin = "clinical-admin"
    senior_clinician = "senior-clinician"
    clinician = "clinician"


# SQLAlchemy ORM model
class UserRecord(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    clinic_id = Column(String, nullable=True)  # null for super-platform-admin
    phone = Column(String, nullable=True)
    address_line = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)  # ISO date YYYY-MM-DD
    postcode = Column(String, nullable=True)
    pay_rate = Column(String, nullable=True)          # numeric string e.g. "350.00"
    pay_type = Column(String, nullable=True)          # per_day | per_assessment | per_annum
    preferred_assessment_type = Column(String, nullable=True)  # child | adult | both
    supervisor_id = Column(String, nullable=True)     # user.id of assigned supervisor
    report_review_rate = Column(String, nullable=True)
    screening_pay_rate = Column(String, nullable=True)


# Pydantic schemas
class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    clinic_id: str | None = None
    phone: str | None = None
    address_line: str | None = None
    postcode: str | None = None
    date_of_birth: str | None = None
    pay_rate: str | None = None
    pay_type: str | None = None
    preferred_assessment_type: str | None = None
    supervisor_id: str | None = None
    report_review_rate: str | None = None
    screening_pay_rate: str | None = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    role: str
    full_name: str
    redirect_path: str
