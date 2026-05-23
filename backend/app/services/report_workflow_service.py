from app.models.workflow import ReportHandoffPayload, WorkflowTask


class ReportWorkflowService:
    def build_task(self, report_status: str) -> WorkflowTask:
        return WorkflowTask(
            key="assessment_report_handoff",
            title="Assessment + report handoff",
            status="in_progress" if report_status != "signed_off" else "complete",
            detail="Assessment evidence has moved into NICE check, report drafting, and sign-off workflow.",
        )

    def build_payload(
        self,
        case_id: str,
        assessment_status: str,
        report_status: str,
    ) -> ReportHandoffPayload:
        return ReportHandoffPayload(
            case_id=case_id,
            assessment_status=assessment_status,
            report_status=report_status,
            handoff_note="Assessment notes are packaged for report generation, NICE review, and final clinical sign-off.",
            nice_check_status="ready" if assessment_status != "scheduled" else "pending",
        )
