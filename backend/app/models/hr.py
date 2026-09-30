"""HR module models — feature settings + all HR record types."""

import json
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text

from app.db.base import Base

HR_FEATURES = [
    "leave",
    "timesheets",
    "supervision",
    "training",
    "incidents",
    "contracts",
]

HR_FEATURE_LABELS: dict[str, str] = {
    "leave": "Leave & Absence",
    "timesheets": "Timesheets",
    "supervision": "Supervision Records",
    "training": "Training & Compliance",
    "incidents": "Incident Reporting",
    "contracts": "Contracts & Documents",
}

ALL_ROLES = ["clinician", "senior-clinician", "clinical-admin"]

HR_DEFAULT_ROLES: dict[str, list[str]] = {
    "leave": ["clinician", "senior-clinician", "clinical-admin"],
    "timesheets": ["clinician", "senior-clinician", "clinical-admin"],
    "supervision": ["senior-clinician", "clinical-admin"],
    "training": ["clinician", "senior-clinician", "clinical-admin"],
    "incidents": ["clinician", "senior-clinician", "clinical-admin"],
    "contracts": ["clinical-admin"],
}


class HrFeatureSettingRecord(Base):
    __tablename__ = "hr_feature_settings"
    feature_key = Column(String, primary_key=True)
    enabled = Column(Boolean, default=True)
    allowed_roles_json = Column(Text, default="[]")


class HrLeaveRequestRecord(Base):
    __tablename__ = "hr_leave_requests"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=True)
    leave_type = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    days = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String, default="pending")
    reviewed_by_user_id = Column(String, nullable=True)
    reviewed_by_name = Column(String, nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HrTimesheetRecord(Base):
    __tablename__ = "hr_timesheets"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=True)
    week_start = Column(String, nullable=False)
    hours_mon = Column(Float, default=0)
    hours_tue = Column(Float, default=0)
    hours_wed = Column(Float, default=0)
    hours_thu = Column(Float, default=0)
    hours_fri = Column(Float, default=0)
    hours_sat = Column(Float, default=0)
    hours_sun = Column(Float, default=0)
    notes = Column(Text, nullable=True)
    status = Column(String, default="draft")
    reviewed_by_user_id = Column(String, nullable=True)
    reviewed_by_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HrSupervisionRecord(Base):
    __tablename__ = "hr_supervision_records"
    id = Column(String, primary_key=True)
    supervisee_user_id = Column(String, nullable=False)
    supervisee_name = Column(String, nullable=True)
    supervisor_user_id = Column(String, nullable=True)
    supervisor_name = Column(String, nullable=True)
    session_date = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    session_type = Column(String, default="individual")
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(String, nullable=True)
    client_id = Column(String, nullable=True)
    client_name = Column(String, nullable=True)
    report_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class HrTrainingRecord(Base):
    __tablename__ = "hr_training_records"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=True)
    training_name = Column(String, nullable=False)
    training_type = Column(String, nullable=True)
    completed_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    status = Column(String, default="pending")
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HrIncidentRecord(Base):
    __tablename__ = "hr_incidents"
    id = Column(String, primary_key=True)
    reporter_user_id = Column(String, nullable=False)
    reporter_name = Column(String, nullable=True)
    incident_type = Column(String, nullable=True)
    severity = Column(String, default="low")
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    incident_date = Column(String, nullable=False)
    status = Column(String, default="open")
    resolution_notes = Column(Text, nullable=True)
    reviewed_by_user_id = Column(String, nullable=True)
    reviewed_by_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HrContractRecord(Base):
    __tablename__ = "hr_contracts"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=True)
    contract_type = Column(String, nullable=True)
    title = Column(String, nullable=False)
    status = Column(String, default="draft")
    file_path = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    signed_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(String, nullable=True)
    created_by_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


def _roles_from_record(r: HrFeatureSettingRecord) -> list[str]:
    try:
        return json.loads(r.allowed_roles_json or "[]")
    except Exception:
        return []


class HrFeatureSettingOut(BaseModel):
    feature_key: str
    label: str
    enabled: bool
    allowed_roles: list[str]
    model_config = ConfigDict(from_attributes=True)


class HrFeatureSettingUpdate(BaseModel):
    enabled: bool | None = None
    allowed_roles: list[str] | None = None


class HrLeaveOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    leave_type: str
    start_date: str
    end_date: str
    days: float | None = None
    reason: str | None = None
    status: str
    reviewed_by_name: str | None = None
    review_note: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class HrLeaveCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    days: float | None = None
    reason: str | None = None


class HrLeaveUpdate(BaseModel):
    status: str | None = None
    review_note: str | None = None
    leave_type: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    days: float | None = None
    reason: str | None = None


class HrTimesheetOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    week_start: str
    hours_mon: float = 0
    hours_tue: float = 0
    hours_wed: float = 0
    hours_thu: float = 0
    hours_fri: float = 0
    hours_sat: float = 0
    hours_sun: float = 0
    notes: str | None = None
    status: str
    reviewed_by_name: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class HrTimesheetCreate(BaseModel):
    week_start: str
    hours_mon: float = 0
    hours_tue: float = 0
    hours_wed: float = 0
    hours_thu: float = 0
    hours_fri: float = 0
    hours_sat: float = 0
    hours_sun: float = 0
    notes: str | None = None


class HrTimesheetUpdate(BaseModel):
    status: str | None = None
    hours_mon: float | None = None
    hours_tue: float | None = None
    hours_wed: float | None = None
    hours_thu: float | None = None
    hours_fri: float | None = None
    hours_sat: float | None = None
    hours_sun: float | None = None
    notes: str | None = None


class HrSupervisionOut(BaseModel):
    id: str
    supervisee_user_id: str
    supervisee_name: str | None = None
    supervisor_user_id: str | None = None
    supervisor_name: str | None = None
    session_date: str
    duration_minutes: int | None = None
    session_type: str
    notes: str | None = None
    client_id: str | None = None
    client_name: str | None = None
    report_id: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class HrSupervisionCreate(BaseModel):
    supervisee_user_id: str
    session_date: str
    supervisor_user_id: str | None = None
    duration_minutes: int | None = None
    session_type: str = "individual"
    notes: str | None = None
    client_id: str | None = None
    client_name: str | None = None
    report_id: str | None = None


class HrTrainingOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    training_name: str
    training_type: str | None = None
    completed_date: str | None = None
    expiry_date: str | None = None
    status: str
    notes: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class HrTrainingCreate(BaseModel):
    user_id: str
    training_name: str
    training_type: str | None = None
    completed_date: str | None = None
    expiry_date: str | None = None
    status: str = "pending"
    notes: str | None = None


class HrTrainingUpdate(BaseModel):
    training_name: str | None = None
    training_type: str | None = None
    completed_date: str | None = None
    expiry_date: str | None = None
    status: str | None = None
    notes: str | None = None


class HrIncidentOut(BaseModel):
    id: str
    reporter_user_id: str
    reporter_name: str | None = None
    incident_type: str | None = None
    severity: str
    title: str
    description: str | None = None
    incident_date: str
    status: str
    resolution_notes: str | None = None
    reviewed_by_name: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class HrIncidentCreate(BaseModel):
    incident_type: str | None = None
    severity: str = "low"
    title: str
    description: str | None = None
    incident_date: str


class HrIncidentUpdate(BaseModel):
    status: str | None = None
    resolution_notes: str | None = None
    severity: str | None = None
    incident_type: str | None = None


class HrContractOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    contract_type: str | None = None
    title: str
    status: str
    file_name: str | None = None
    signed_date: str | None = None
    expiry_date: str | None = None
    notes: str | None = None
    created_by_name: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class HrContractCreate(BaseModel):
    user_id: str
    contract_type: str | None = None
    title: str
    status: str = "draft"
    signed_date: str | None = None
    expiry_date: str | None = None
    notes: str | None = None


class HrContractUpdate(BaseModel):
    contract_type: str | None = None
    title: str | None = None
    status: str | None = None
    signed_date: str | None = None
    expiry_date: str | None = None
    notes: str | None = None
