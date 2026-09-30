from fastapi import APIRouter, HTTPException

from app.models.assessment import Assessment, AssessmentDetail
from app.services.form_service import FormService
from app.services.report_workflow_service import ReportWorkflowService
from app.services.session_brief_service import SessionBriefService

router = APIRouter()
form_service = FormService()
session_brief_service = SessionBriefService()
report_workflow_service = ReportWorkflowService()

ASSESSMENT_DETAILS: list[AssessmentDetail] = [
    AssessmentDetail(
        id="assessment-001",
        client_id="client-001",
        client_name="Alex Taylor",
        screening_type="ADHD",
        pathway="Adult ADHD",
        status="in_review",
        stage="Clinical review",
        clinician_name="Dr Jordan Lee",
        appointment_date="2026-04-14",
        report_due_date="2026-04-18",
        evidence_completeness=88,
        note_summary_status="complete",
        risk_level="standard",
        next_action="Finalize diagnostic impression and approve report draft.",
        referral_source="Self referral",
        client_age_group="Adult",
        forms_received=["Intake form", "ASRS", "Collateral history"],
        missing_items=["Employer evidence"],
        timeline=[
            "Referral received and triaged",
            "Initial screening forms completed",
            "Clinical interview completed",
            "Draft report generated",
        ],
        key_observations=[
            "Sustained attention challenges present across work and home settings.",
            "Client reports long-term executive functioning difficulties.",
            "Collateral feedback broadly aligns with self-report.",
        ],
        draft_sections_ready=["Background", "Clinical interview", "Summary"],
        downstream_tasks=[
            form_service.build_welcome_pack_task("Alex Taylor", "Adult ADHD"),
            session_brief_service.build_task("Dr Jordan Lee", "2026-04-14T09:00:00"),
            report_workflow_service.build_task("drafting"),
        ],
        session_brief=session_brief_service.build_payload(
            "case-1001",
            "Alex Taylor",
            "Dr Jordan Lee",
            "2026-04-14T09:00:00",
        ),
        report_handoff=report_workflow_service.build_payload(
            "case-1001",
            "in_review",
            "drafting",
        ),
    ),
    AssessmentDetail(
        id="assessment-002",
        client_id="client-002",
        client_name="Maya Singh",
        screening_type="Autism",
        pathway="Adult Autism",
        status="awaiting_information",
        stage="Evidence collection",
        clinician_name="Dr Samir Patel",
        appointment_date="2026-04-16",
        report_due_date="2026-04-24",
        evidence_completeness=61,
        note_summary_status="pending",
        risk_level="standard",
        next_action="Collect informant questionnaire before diagnostic review.",
        referral_source="GP referral",
        client_age_group="Adult",
        forms_received=["Referral summary", "Intake form"],
        missing_items=["Informant questionnaire", "School history"],
        timeline=[
            "GP referral reviewed",
            "Client intake completed",
            "Observation session booked",
        ],
        key_observations=[
            "Sensory sensitivities noted in work and social contexts.",
            "Client describes persistent masking and fatigue after social demands.",
        ],
        draft_sections_ready=["Background"],
        downstream_tasks=[
            form_service.build_welcome_pack_task("Maya Singh", "Adult Autism"),
            session_brief_service.build_task("Dr Samir Patel", "2026-04-16T13:30:00"),
            report_workflow_service.build_task("drafting"),
        ],
        session_brief=session_brief_service.build_payload(
            "case-1002",
            "Maya Singh",
            "Dr Samir Patel",
            "2026-04-16T13:30:00",
        ),
        report_handoff=report_workflow_service.build_payload(
            "case-1002",
            "awaiting_information",
            "drafting",
        ),
    ),
    AssessmentDetail(
        id="assessment-003",
        client_id="client-003",
        client_name="Noah Williams",
        screening_type="Combined",
        pathway="Child ADHD + Autism",
        status="scheduled",
        stage="Pre-assessment",
        clinician_name="Dr Priya Raman",
        appointment_date="2026-04-22",
        report_due_date="2026-05-01",
        evidence_completeness=47,
        note_summary_status="not_started",
        risk_level="priority",
        next_action="Confirm school feedback pack and parent forms before session.",
        referral_source="School referral",
        client_age_group="Child",
        forms_received=["Parent intake", "Teacher concerns summary"],
        missing_items=["School questionnaire", "Developmental history form"],
        timeline=[
            "Referral accepted",
            "Parent intake submitted",
            "Assessment slot reserved",
        ],
        key_observations=[
            "School concerns point to attention regulation and sensory overload.",
            "Parent notes high support needs during transitions.",
        ],
        draft_sections_ready=[],
        downstream_tasks=[
            form_service.build_welcome_pack_task("Noah Williams", "Child ADHD + Autism"),
            session_brief_service.build_task("Dr Priya Raman", "2026-04-22T10:00:00"),
            report_workflow_service.build_task("not_started"),
        ],
        session_brief=session_brief_service.build_payload(
            "case-1003",
            "Noah Williams",
            "Dr Priya Raman",
            "2026-04-22T10:00:00",
        ),
        report_handoff=report_workflow_service.build_payload(
            "case-1003",
            "scheduled",
            "not_started",
        ),
    ),
]


@router.get("/")
def list_assessments() -> dict[str, list[dict[str, object]]]:
    items = [Assessment(**item.model_dump()).model_dump() for item in ASSESSMENT_DETAILS]
    return {"items": items}


@router.get("/{assessment_id}")
def get_assessment(assessment_id: str) -> dict[str, object]:
    for assessment in ASSESSMENT_DETAILS:
        if assessment.id == assessment_id:
            return assessment.model_dump()

    raise HTTPException(status_code=404, detail="Assessment not found")
