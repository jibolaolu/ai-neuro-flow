"""
Async AI worker implementations.

Each worker function receives the job payload dict and returns a result dict.
Workers are dispatched by the APScheduler job every 30 seconds.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from app.ai.llm_gateway import llm_gateway
from app.ai.rag_engine import rag_engine
from app.models.ai_job import (
    AIJobRecord,
    JOB_STATUS_DONE,
    JOB_STATUS_FAILED,
    JOB_STATUS_QUEUED,
    JOB_STATUS_RUNNING,
    WORKER_DOC_EXTRACT,
    WORKER_FORM_ANALYSER,
    WORKER_NOTE_PROCESSOR,
    WORKER_REPORT_DRAFT,
    WORKER_RISK_STRAT,
)

logger = logging.getLogger(__name__)


# ── Individual workers ────────────────────────────────────────────────────────

def _worker_form_analyser(payload: dict) -> dict:
    """Analyse a submitted form's responses for clinical patterns."""
    form_data  = payload.get("form_data", {})
    pathway    = payload.get("pathway", "adult")
    client_id  = payload.get("client_id", "")
    clinic_id  = payload.get("clinic_id", "")

    # Build a text representation for indexing
    form_text = json.dumps(form_data, indent=2)[:3000]

    # Index form responses in vector store for future retrieval
    rag_engine.index_document(
        collection="form_responses",
        doc_id=f"form:{client_id}:{pathway}",
        text=form_text,
        clinic_id=clinic_id,
        metadata={"client_id": client_id, "pathway": pathway},
    )

    result = llm_gateway.call_json(
        f"Analyse this {pathway} intake form for a UK ADHD/Autism assessment. "
        "Return JSON: {completeness_score: 0-100, key_concerns: [], "
        "recommended_follow_ups: [], data_quality_flags: []}.\n\n"
        f"Form responses:\n{form_text}",
        max_tokens=600,
    )
    result["client_id"] = client_id
    result["indexed"]   = True
    return result


def _worker_note_processor(payload: dict) -> dict:
    """Process and index a clinician note."""
    note_id   = payload.get("note_id", "")
    note_text = payload.get("note_text", "")
    client_id = payload.get("client_id", "")
    clinic_id = payload.get("clinic_id", "")

    rag_engine.index_document(
        collection="case_notes",
        doc_id=f"note:{note_id}",
        text=note_text,
        clinic_id=clinic_id,
        metadata={"client_id": client_id, "note_id": note_id},
    )

    result = llm_gateway.call_json(
        "Extract structured insights from this clinical note. "
        "Return JSON: {key_observations: [], action_items: [], risk_indicators: [], "
        "follow_up_date: null or 'YYYY-MM-DD'}.\n\n"
        f"Note:\n{note_text[:2000]}",
        max_tokens=500,
    )
    result["note_id"] = note_id
    result["indexed"] = True
    return result


def _worker_report_draft(payload: dict) -> dict:
    """Generate a report section draft using RAG context."""
    section      = payload.get("section", "Background")
    scores       = payload.get("scores", {})
    case_notes   = payload.get("case_notes", "")
    client_id    = payload.get("client_id", "")
    clinic_id    = payload.get("clinic_id", "")

    # Retrieve similar sections from existing reports
    similar = rag_engine.retrieve(
        f"{section} ADHD autism assessment",
        collection="clinical_documents",
        clinic_id=clinic_id,
        n_results=3,
    ).get("matches", [])

    draft = llm_gateway.suggest_report_section(
        section_name=section,
        scores=scores,
        case_notes=case_notes,
        similar_cases=similar,
    )
    return {"section": section, "draft": draft, "client_id": client_id}


def _worker_doc_extract(payload: dict) -> dict:
    """OCR and index a client document."""
    doc_id    = payload.get("doc_id", "")
    file_path = payload.get("file_path", "")
    client_id = payload.get("client_id", "")
    clinic_id = payload.get("clinic_id", "")

    try:
        from app.services.ocr_service import ocr_service
        text = ocr_service.extract_text(file_path)
    except Exception as exc:
        logger.warning("OCR failed for %s: %s", file_path, exc)
        text = ""

    if text.strip():
        rag_engine.index_document(
            collection="clinical_documents",
            doc_id=f"doc:{doc_id}",
            text=text,
            clinic_id=clinic_id,
            metadata={"client_id": client_id, "doc_id": doc_id, "file_path": file_path},
        )

    return {
        "doc_id":    doc_id,
        "text_len":  len(text),
        "indexed":   bool(text.strip()),
        "ocr_text":  text[:500] if text else "",
    }


def _worker_risk_stratification(payload: dict) -> dict:
    """AI risk stratification across all instruments."""
    scores     = payload.get("scores", {})
    case_notes = payload.get("case_notes", "")
    client_id  = payload.get("client_id", "")

    context = f"Instrument scores:\n{json.dumps(scores, indent=2)}\n\nClinician notes:\n{case_notes or 'None'}"
    result = llm_gateway.stratify_risk(context)
    result["client_id"] = client_id
    return result


# ── Dispatcher ────────────────────────────────────────────────────────────────

_WORKERS = {
    WORKER_FORM_ANALYSER:  _worker_form_analyser,
    WORKER_NOTE_PROCESSOR: _worker_note_processor,
    WORKER_REPORT_DRAFT:   _worker_report_draft,
    WORKER_DOC_EXTRACT:    _worker_doc_extract,
    WORKER_RISK_STRAT:     _worker_risk_stratification,
}


def enqueue_job(
    *,
    worker_type: str,
    payload: dict,
    clinic_id: str | None = None,
    created_by: str | None = None,
    db,
) -> AIJobRecord:
    """Create a new queued job and persist it."""
    job = AIJobRecord(
        id=f"JOB-{uuid.uuid4().hex[:8].upper()}",
        worker_type=worker_type,
        status=JOB_STATUS_QUEUED,
        clinic_id=clinic_id,
        created_by=created_by,
        payload=json.dumps(payload),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info("Job enqueued: %s [%s]", job.id, worker_type)
    return job


def process_pending_jobs() -> None:
    """
    APScheduler entry point — picks up to 5 queued jobs and runs them.
    Called every 30 seconds by the scheduler.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        pending = (
            db.query(AIJobRecord)
            .filter(AIJobRecord.status == JOB_STATUS_QUEUED)
            .order_by(AIJobRecord.created_at)
            .limit(5)
            .all()
        )

        for job in pending:
            job.status     = JOB_STATUS_RUNNING
            job.started_at = datetime.now(timezone.utc)
            db.commit()

            try:
                payload = json.loads(job.payload or "{}")
                worker  = _WORKERS.get(job.worker_type)
                if worker is None:
                    raise ValueError(f"Unknown worker type: {job.worker_type}")

                result = worker(payload)

                job.status       = JOB_STATUS_DONE
                job.result       = json.dumps(result)
                job.completed_at = datetime.now(timezone.utc)
                logger.info("Job complete: %s [%s]", job.id, job.worker_type)

            except Exception as exc:
                job.status       = JOB_STATUS_FAILED
                job.error        = str(exc)
                job.completed_at = datetime.now(timezone.utc)
                logger.error("Job failed: %s [%s] — %s", job.id, job.worker_type, exc)

            db.commit()

    except Exception as exc:
        logger.error("process_pending_jobs crashed: %s", exc)
        db.rollback()
    finally:
        db.close()
