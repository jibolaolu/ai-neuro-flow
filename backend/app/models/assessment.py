from pydantic import BaseModel

from app.models.workflow import ReportHandoffPayload, SessionBrieferPayload, WorkflowTask


class Assessment(BaseModel):
    id: str
    client_id: str
    client_name: str
    screening_type: str
    pathway: str
    status: str
    stage: str
    clinician_name: str
    appointment_date: str
    report_due_date: str
    evidence_completeness: int
    note_summary_status: str
    risk_level: str
    next_action: str


class AssessmentDetail(Assessment):
    referral_source: str
    client_age_group: str
    forms_received: list[str]
    missing_items: list[str]
    timeline: list[str]
    key_observations: list[str]
    draft_sections_ready: list[str]
    downstream_tasks: list[WorkflowTask]
    session_brief: SessionBrieferPayload
    report_handoff: ReportHandoffPayload
