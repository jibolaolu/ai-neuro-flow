"""
Real LLM Gateway — Anthropic Claude with retry + token tracking.

Primary provider: Anthropic (claude-sonnet-4-6 by default, configurable)
Fallback: graceful error; add OpenAI/Gemini keys to config for multi-provider routing.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAY = 1.5  # seconds, doubled on each retry


class LLMGateway:
    def get_model_metadata(self) -> dict[str, str]:
        from app.core.config import settings
        return {
            "provider": "anthropic",
            "model": settings.anthropic_model,
            "status": "active",
        }

    # ── Core call ─────────────────────────────────────────────────────────────

    def call(
        self,
        prompt: str,
        *,
        system: str | None = None,
        max_tokens: int = 1500,
        model: str | None = None,
        json_mode: bool = False,
    ) -> str:
        """
        Call Claude and return the text response.
        Retries up to _MAX_RETRIES on transient errors.
        Raises RuntimeError if all retries fail.
        """
        from app.core.config import settings
        import anthropic

        _model = model or settings.anthropic_model
        api_key = settings.anthropic_api_key or None
        client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

        sys_prompt = system or (
            "You are a specialist clinical assistant for Neuro Flow, a UK-based "
            "ADHD and Autism assessment service."
        )
        if json_mode:
            sys_prompt += " Always respond with valid JSON only — no markdown, no extra text."

        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]

        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                response = client.messages.create(
                    model=_model,
                    max_tokens=max_tokens,
                    system=sys_prompt,
                    messages=messages,
                )
                text = response.content[0].text if response.content else ""
                logger.debug(
                    "LLM call ok | model=%s tokens_in=%s tokens_out=%s",
                    _model,
                    response.usage.input_tokens if response.usage else "?",
                    response.usage.output_tokens if response.usage else "?",
                )
                return text
            except Exception as exc:
                last_exc = exc
                logger.warning("LLM call attempt %d failed: %s", attempt + 1, exc)
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_RETRY_DELAY * (2 ** attempt))

        raise RuntimeError(f"LLM call failed after {_MAX_RETRIES} attempts: {last_exc}") from last_exc

    def call_json(
        self,
        prompt: str,
        *,
        system: str | None = None,
        max_tokens: int = 1500,
        model: str | None = None,
    ) -> dict:
        """Call Claude and parse the response as JSON. Returns dict."""
        raw = self.call(prompt, system=system, max_tokens=max_tokens, model=model, json_mode=True)
        raw = raw.strip()
        # Strip markdown fences if the model adds them anyway
        if raw.startswith("```"):
            lines = raw.splitlines()
            inner = lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:]
            raw = "\n".join(inner).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error("LLM JSON parse failed: %s | raw=%r", exc, raw[:200])
            return {"error": str(exc), "raw": raw}

    # ── Convenience wrappers ──────────────────────────────────────────────────

    def summarise(self, text: str, *, max_words: int = 150) -> str:
        prompt = (
            f"Summarise the following clinical text in no more than {max_words} words. "
            f"Be concise, clinical, and factual:\n\n{text}"
        )
        return self.call(prompt, max_tokens=400)

    def suggest_soap(self, context: str) -> dict:
        prompt = (
            "Based on the following clinical context, generate a structured SOAP note. "
            "Return JSON with keys: subjective, objective, assessment, plan.\n\n"
            f"Context:\n{context}"
        )
        return self.call_json(prompt, max_tokens=800)

    def analyse_discrepancy(self, context: str) -> dict:
        prompt = (
            "You are a clinical psychologist. Analyse the following cross-informant score data "
            "and identify meaningful discrepancies between raters. Return JSON with keys: "
            "summary (string), discrepancies (list of {raters, domain, difference, clinical_note}), "
            "flags (list of urgent concerns).\n\n"
            f"Data:\n{context}"
        )
        return self.call_json(prompt, max_tokens=1000)

    def stratify_risk(self, context: str) -> dict:
        prompt = (
            "You are a specialist ADHD/Autism clinical risk assessor. "
            "Based on the following instrument scores and clinical notes, produce a risk stratification. "
            "Return JSON with keys: overall_risk (low/moderate/high/critical), "
            "risk_factors (list), protective_factors (list), immediate_actions (list), "
            "monitoring_recommendations (list).\n\n"
            f"Clinical data:\n{context}"
        )
        return self.call_json(prompt, max_tokens=1000)

    def qa_review(self, report_text: str, section_checklist: list[str]) -> dict:
        checklist_str = "\n".join(f"- {c}" for c in section_checklist)
        prompt = (
            "Review the following clinical report for completeness and compliance. "
            "Return JSON with keys: passed (bool), issues (list of {section, issue, severity}), "
            "missing_sections (list), score (0-100).\n\n"
            f"Required sections:\n{checklist_str}\n\n"
            f"Report:\n{report_text[:4000]}"
        )
        return self.call_json(prompt, max_tokens=800)

    def suggest_report_section(
        self,
        section_name: str,
        scores: dict,
        case_notes: str,
        similar_cases: list[dict],
    ) -> str:
        similar_text = ""
        for sc in similar_cases[:3]:
            similar_text += f"\n---\n{sc.get('text', '')[:500]}"

        prompt = (
            f"You are writing the '{section_name}' section of a UK NHS-aligned ADHD/Autism "
            f"assessment report. Based on the data below, draft 2-4 paragraphs suitable for "
            f"clinical use. Write in third person, professional clinical language.\n\n"
            f"Instrument scores:\n{json.dumps(scores, indent=2)}\n\n"
            f"Clinician notes:\n{case_notes or 'None provided'}\n\n"
            f"Similar completed sections from other reports:{similar_text or ' None available'}"
        )
        return self.call(prompt, max_tokens=1200)

    def suggest_clinician_assignment(
        self,
        client_pathway: str,
        client_age_group: str,
        clinicians: list[dict],
    ) -> dict:
        """Rank clinicians for a client based on specialization, caseload, and availability."""
        prompt = (
            "You are a clinical operations scheduler for a UK ADHD/Autism assessment service. "
            "Rank the following clinicians for the client and explain your reasoning. "
            "Return JSON with keys: ranked (list of {clinician_id, name, score 0-100, rationale}), "
            "top_recommendation (clinician_id), summary (string).\n\n"
            f"Client pathway: {client_pathway}\n"
            f"Client age group: {client_age_group}\n\n"
            f"Available clinicians:\n{json.dumps(clinicians, indent=2)}"
        )
        return self.call_json(prompt, max_tokens=800)

    def predict_form_completion(
        self,
        days_since_sent: int,
        reminder_count: int,
        pathway: str,
        completion_rate: float,
    ) -> dict:
        """Predict whether a pending form is likely to be completed without further action."""
        prompt = (
            "You are an engagement prediction model for a clinical assessment platform. "
            "Given the data below, predict whether this client will complete their form "
            "in the next 48 hours WITHOUT a reminder. "
            "Return JSON with keys: completion_probability (0.0-1.0), "
            "recommended_action (one of: wait, send_reminder, escalate_to_clinician, close_token), "
            "urgency (low/medium/high), reasoning (string).\n\n"
            f"Days since form sent: {days_since_sent}\n"
            f"Previous reminders sent: {reminder_count}\n"
            f"Assessment pathway: {pathway}\n"
            f"Clinic historical completion rate: {completion_rate:.1%}"
        )
        return self.call_json(prompt, max_tokens=400)

    def client_chat(self, message: str, context: str) -> str:
        """Respond to a client's question about their assessment in plain, accessible language."""
        system = (
            "You are a friendly, supportive assistant for a UK ADHD and Autism assessment service. "
            "Answer questions in clear, accessible language (no jargon). Be warm, concise, and accurate. "
            "Do not provide diagnoses or medical advice. Reassure and guide clients through the process."
        )
        prompt = (
            f"Assessment context for this client:\n{context}\n\n"
            f"Client question: {message}"
        )
        return self.call(prompt, system=system, max_tokens=500)


# Module-level singleton
llm_gateway = LLMGateway()
