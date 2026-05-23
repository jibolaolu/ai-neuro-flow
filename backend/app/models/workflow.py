from pydantic import BaseModel


class WorkflowTask(BaseModel):
    key: str
    title: str
    status: str
    detail: str


class SessionBrieferPayload(BaseModel):
    case_id: str
    client_name: str
    clinician_name: str
    session_time: str
    summary: str


class ReportHandoffPayload(BaseModel):
    case_id: str
    assessment_status: str
    report_status: str
    handoff_note: str
    nice_check_status: str
