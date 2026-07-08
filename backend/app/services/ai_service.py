"""
Real AI orchestration service — routes requests through the LLM Gateway.
Replaces the previous stub that returned "Source length: {len(notes)}".
"""

from __future__ import annotations

import logging

from app.ai.llm_gateway import llm_gateway
from app.ai.rag_engine import rag_engine

logger = logging.getLogger(__name__)


class AIService:
    # ── Report summary (was the stub) ─────────────────────────────────────────

    def generate_report_summary(self, notes: str, *, clinic_id: str | None = None) -> str:
        """
        Generate a concise clinical summary from raw notes.
        Uses RAG context if available; falls back to direct LLM call.
        """
        if not notes.strip():
            return "No clinical notes provided."

        # Optionally enrich with similar cases from the vector store
        context_snippets = ""
        if clinic_id:
            results = rag_engine.retrieve(
                notes[:500],
                collection="case_notes",
                clinic_id=clinic_id,
                n_results=3,
            )
            for m in results.get("matches", []):
                context_snippets += f"\n\nSimilar case note:\n{m['text'][:400]}"

        prompt = (
            "Summarise the following clinical notes into a concise 3-5 sentence overview "
            "suitable for inclusion in a clinical assessment report. "
            "Focus on presenting symptoms, functional impact, and key clinical observations. "
            "Use professional clinical language.\n\n"
            f"Notes:\n{notes}"
        )
        if context_snippets:
            prompt += f"\n\nContext from similar cases:{context_snippets}"

        try:
            return llm_gateway.call(prompt, max_tokens=500)
        except Exception as exc:
            logger.error("generate_report_summary failed: %s", exc)
            return f"Summary unavailable: {exc}"

    # ── Form analysis ─────────────────────────────────────────────────────────

    def analyse_form(self, form_data: dict, *, pathway: str = "adult") -> dict:
        """
        Analyse a submitted intake form for clinical patterns and completeness.
        Returns structured insights.
        """
        import json
        prompt = (
            f"Analyse this {pathway} ADHD/Autism intake form submission. "
            "Return JSON with keys: completeness_score (0-100), key_concerns (list), "
            "recommended_instruments (list), data_quality_flags (list).\n\n"
            f"Form data:\n{json.dumps(form_data, indent=2)[:3000]}"
        )
        try:
            return llm_gateway.call_json(prompt, max_tokens=600)
        except Exception as exc:
            logger.error("analyse_form failed: %s", exc)
            return {"error": str(exc)}

    # ── Note processing ───────────────────────────────────────────────────────

    def process_note(
        self,
        note_text: str,
        *,
        client_id: str,
        clinic_id: str,
        note_id: str,
    ) -> dict:
        """
        Process a case note: extract key points and index it for future RAG retrieval.
        """
        # Index in vector store
        rag_engine.index_document(
            collection="case_notes",
            doc_id=f"note:{note_id}",
            text=note_text,
            clinic_id=clinic_id,
            metadata={"client_id": client_id, "note_id": note_id},
        )

        # Extract structured insights
        prompt = (
            "Extract structured clinical insights from this clinician note. "
            "Return JSON with keys: key_observations (list), action_items (list), "
            "risk_indicators (list), follow_up_date (string or null).\n\n"
            f"Note:\n{note_text}"
        )
        try:
            result = llm_gateway.call_json(prompt, max_tokens=500)
            result["indexed"] = True
            return result
        except Exception as exc:
            logger.error("process_note failed: %s", exc)
            return {"error": str(exc), "indexed": True}

    # ── Outcome prediction ────────────────────────────────────────────────────

    def predict_outcome(self, client_data: dict) -> dict:
        """
        Predict likely assessment outcomes and recovery trajectory.
        """
        import json
        prompt = (
            "Based on this client's assessment data, predict likely outcomes. "
            "Return JSON with keys: predicted_diagnosis (string), confidence (low/medium/high), "
            "treatment_response_likelihood (string), follow_up_recommendations (list).\n\n"
            f"Client data:\n{json.dumps(client_data, indent=2)[:2000]}"
        )
        try:
            return llm_gateway.call_json(prompt, max_tokens=600)
        except Exception as exc:
            logger.error("predict_outcome failed: %s", exc)
            return {"error": str(exc)}
