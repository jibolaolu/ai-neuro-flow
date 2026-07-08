"""
AI-driven session brief service.
Generates real pre-session briefings from client intake data, scores, and forms.
"""
from __future__ import annotations

import json
import logging

from app.models.workflow import SessionBrieferPayload, WorkflowTask

logger = logging.getLogger(__name__)


class SessionBriefService:
    def build_task(self, clinician_name: str, session_time: str) -> WorkflowTask:
        return WorkflowTask(
            key="session_brief",
            title="Session briefer",
            status="queued",
            detail=f"30-minute briefing scheduled before {session_time} for {clinician_name}.",
        )

    def build_payload(
        self,
        case_id: str,
        client_name: str,
        clinician_name: str,
        session_time: str,
    ) -> SessionBrieferPayload:
        return SessionBrieferPayload(
            case_id=case_id,
            client_name=client_name,
            clinician_name=clinician_name,
            session_time=session_time,
            summary=(
                f"{client_name} requires a focused pre-session brief covering intake completeness, "
                f"presenting concerns, and evidence gaps before {session_time}."
            ),
        )

    def build_ai_payload(
        self,
        case_id: str,
        client_name: str,
        clinician_name: str,
        session_time: str,
        pathway: str,
        age_group: str = "Adult",
        scores: dict | None = None,
        form_responses: dict | None = None,
        case_notes: list[str] | None = None,
        missing_items: list[str] | None = None,
    ) -> SessionBrieferPayload:
        """AI-generated pre-session brief from real client data."""
        try:
            from app.ai.llm_gateway import llm_gateway

            context_parts = [
                f"Client: {client_name}",
                f"Pathway: {pathway} ({age_group})",
                f"Clinician: {clinician_name}",
                f"Session: {session_time}",
            ]
            if scores:
                context_parts.append(f"Scores received: {json.dumps(scores)[:800]}")
            if form_responses:
                context_parts.append(f"Key form responses: {json.dumps(form_responses)[:600]}")
            if case_notes:
                context_parts.append(f"Recent clinical notes: {'; '.join(case_notes[-3:])}")
            if missing_items:
                context_parts.append(f"Missing items: {', '.join(missing_items)}")

            prompt = (
                "You are a clinical coordinator preparing a pre-session brief for a UK ADHD/Autism assessment clinician. "
                "Write a concise pre-session brief (3-5 sentences) highlighting: key presenting concerns, "
                "what evidence has been received, what is still missing, and the top 2 areas to probe in session. "
                "Be clinical, practical, and specific.\n\n"
                + "\n".join(context_parts)
            )
            summary = llm_gateway.call(prompt, max_tokens=350)
        except Exception as exc:
            logger.debug("AI session brief failed, using default: %s", exc)
            summary = (
                f"{client_name} requires a focused pre-session brief covering intake completeness, "
                f"presenting concerns, and evidence gaps before {session_time}."
            )

        return SessionBrieferPayload(
            case_id=case_id,
            client_name=client_name,
            clinician_name=clinician_name,
            session_time=session_time,
            summary=summary,
        )
