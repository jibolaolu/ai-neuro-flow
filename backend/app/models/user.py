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


# Pydantic schemas
class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    clinic_id: str | None = None

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
