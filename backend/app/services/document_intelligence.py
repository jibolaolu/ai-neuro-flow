"""
Document Intelligence — OCR + structured extraction + ChromaDB indexing.

Called when a client document is uploaded. Runs asynchronously via AI job queue.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.ai.rag_engine import rag_engine
from app.ai.llm_gateway import llm_gateway
from app.services.ocr_service import ocr_service

logger = logging.getLogger(__name__)


class DocumentIntelligence:
    def process_document(
        self,
        *,
        doc_id: str,
        file_path: str,
        client_id: str,
        clinic_id: str,
        document_type: str = "general",
    ) -> dict:
        """
        Full pipeline: OCR → structure detection → AI extraction → ChromaDB index.
        Returns extraction result dict to be stored in the document record.
        """
        # 1. OCR
        extracted = ocr_service.extract_structured(file_path)
        text = extracted.get("text", "")

        if not text.strip():
            logger.warning("No text extracted from %s", file_path)
            return {"doc_id": doc_id, "text_len": 0, "indexed": False, "error": "No text extracted"}

        # 2. AI extraction for clinical document types
        ai_summary = {}
        if document_type in ("gp_letter", "school_report", "previous_assessment", "medical_report"):
            try:
                ai_summary = llm_gateway.call_json(
                    f"Extract key clinical information from this {document_type.replace('_', ' ')}. "
                    "Return JSON: {summary: string, diagnoses: [], medications: [], "
                    "key_history: [], recommendations: [], dates: []}.\n\n"
                    f"Document:\n{text[:3000]}",
                    max_tokens=800,
                )
            except Exception as exc:
                logger.warning("Document AI extraction failed: %s", exc)
                ai_summary = {"error": str(exc)}

        # 3. Index in ChromaDB
        indexed = rag_engine.index_document(
            collection="clinical_documents",
            doc_id=f"doc:{doc_id}",
            text=text,
            clinic_id=clinic_id,
            metadata={
                "client_id":     client_id,
                "doc_id":        doc_id,
                "document_type": document_type,
            },
        )

        return {
            "doc_id":     doc_id,
            "text_len":   len(text),
            "sections":   extracted.get("sections", []),
            "indexed":    indexed,
            "ai_summary": ai_summary,
            "ocr_preview": text[:500],
        }

    def search_client_documents(
        self,
        query: str,
        *,
        client_id: str,
        clinic_id: str,
        n_results: int = 5,
    ) -> list[dict]:
        """Semantic search over a client's uploaded documents."""
        results = rag_engine.retrieve(
            query,
            collection="clinical_documents",
            clinic_id=clinic_id,
            n_results=n_results,
        )
        # Filter to this client only
        matches = [
            m for m in results.get("matches", [])
            if m.get("metadata", {}).get("client_id") == client_id
        ]
        return matches

    def auto_populate_report_fields(
        self,
        *,
        client_id: str,
        clinic_id: str,
        report_section: str,
    ) -> str:
        """
        Given a report section name, find relevant document snippets and suggest content.
        """
        matches = self.search_client_documents(
            report_section,
            client_id=client_id,
            clinic_id=clinic_id,
            n_results=3,
        )
        if not matches:
            return ""

        snippets = "\n\n---\n\n".join(m.get("text", "")[:600] for m in matches)
        try:
            return llm_gateway.call(
                f"Based on the following excerpts from the client's uploaded documents, "
                f"draft content suitable for the '{report_section}' section of a clinical report. "
                f"Be factual and cite information from the documents provided.\n\n"
                f"Document excerpts:\n{snippets}",
                max_tokens=600,
            )
        except Exception as exc:
            logger.error("auto_populate_report_fields failed: %s", exc)
            return ""


# Module-level singleton
document_intelligence = DocumentIntelligence()
