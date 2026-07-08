"""
AI-driven report workflow service.
Generates dynamic handoff notes and task status from real client data.
"""
from __future__ import annotations

import logging

from app.models.workflow import ReportHandoffPayload, WorkflowTask

logger = logging.getLogger(__name__)


class ReportWorkflowService:
    def build_task(self, report_status: str) -> WorkflowTask:
        status_map = {
            "not_started":   ("queued",      "Assessment evidence is ready. Report drafting has not yet started."),
            "drafting":      ("in_progress", "Report is being drafted. NICE compliance check and sign-off pending."),
            "review":        ("in_progress", "Report is under senior-clinician review and quality assurance."),
            "signed_off":    ("complete",    "Report signed off and dispatched to client and referrer."),
            "returned":      ("in_progress", "Report returned for revision. Clinician is addressing reviewer comments."),
        }
        status, detail = status_map.get(report_status, ("queued", "Awaiting report workflow initiation."))
        return WorkflowTask(
            key="assessment_report_handoff",
            title="Assessment + report handoff",
            status=status,
            detail=detail,
        )

    def build_payload(
        self,
        case_id: str,
        assessment_status: str,
        report_status: str,
    ) -> ReportHandoffPayload:
        note = "Assessment notes are packaged for report generation, NICE review, and final clinical sign-off."
        nice_check_status = "pending" if assessment_status == "scheduled" else "ready"
        return ReportHandoffPayload(
            case_id=case_id,
            assessment_status=assessment_status,
            report_status=report_status,
            handoff_note=note,
            nice_check_status=nice_check_status,
        )

    def build_ai_payload(
        self,
        case_id: str,
        client_name: str,
        pathway: str,
        assessment_status: str,
        report_status: str,
        scores: dict | None = None,
        missing_items: list[str] | None = None,
    ) -> ReportHandoffPayload:
        """AI-generated handoff note based on real client data."""
        try:
            from app.ai.llm_gateway import llm_gateway
            scores_text = f"\nInstrument scores: {scores}" if scores else ""
            missing_text = f"\nMissing items: {', '.join(missing_items)}" if missing_items else ""
            prompt = (
                f"Write a 2-3 sentence clinical handoff note for a UK ADHD/Autism assessment workflow. "
                f"Client: {client_name} | Pathway: {pathway} | "
                f"Assessment status: {assessment_status} | Report status: {report_status}."
                f"{scores_text}{missing_text}\n"
                f"The note should guide the receiving clinician on next steps. Be concise and clinical."
            )
            note = llm_gateway.call(prompt, max_tokens=200)
        except Exception as exc:
            logger.debug("AI handoff note failed, using default: %s", exc)
            note = (
                f"Assessment for {client_name} ({pathway}) is {assessment_status}. "
                f"Report is {report_status}. Review evidence completeness before proceeding."
            )

        return ReportHandoffPayload(
            case_id=case_id,
            assessment_status=assessment_status,
            report_status=report_status,
            handoff_note=note,
            nice_check_status="ready" if assessment_status not in ("scheduled", "not_started") else "pending",
        )
