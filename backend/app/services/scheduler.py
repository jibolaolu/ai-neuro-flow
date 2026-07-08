"""
APScheduler background jobs.
Started on FastAPI startup, runs in-process.
"""

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.session import SessionLocal
from app.models.form_token import FormToken, STATUS_PENDING, STATUS_REMINDED
from app.models.client import ClientRecord
from app.services import email as email_svc

logger = logging.getLogger(__name__)

REMINDER_AFTER_DAYS = 4

scheduler = BackgroundScheduler(timezone="Europe/London")


def check_overdue_forms() -> None:
    """
    Daily job: find form tokens still pending after REMINDER_AFTER_DAYS.
    Uses AI to predict completion likelihood — only sends reminder when recommended.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=REMINDER_AFTER_DAYS)

        overdue = (
            db.query(FormToken)
            .filter(
                FormToken.status == STATUS_PENDING,
                FormToken.sent_at <= cutoff,
                FormToken.reminder_sent_at.is_(None),
            )
            .all()
        )

        from app.core.config import settings
        platform_url = getattr(settings, "platform_base_url", "http://localhost:3004")

        for token_record in overdue:
            client = db.query(ClientRecord).filter(
                ClientRecord.id == token_record.client_id
            ).first()
            if not client:
                continue

            # AI adaptive prediction — skip reminder if client is likely to complete
            sent_at = token_record.sent_at
            if sent_at and sent_at.tzinfo is None:
                sent_at = sent_at.replace(tzinfo=timezone.utc)
            days_since = (datetime.now(timezone.utc) - sent_at).days if sent_at else REMINDER_AFTER_DAYS
            reminder_count = 1 if token_record.reminder_sent_at else 0

            action = "send_reminder"  # default
            try:
                from app.ai.llm_gateway import llm_gateway
                pred = llm_gateway.predict_form_completion(
                    days_since_sent=days_since,
                    reminder_count=reminder_count,
                    pathway=token_record.form_type or "Assessment",
                    completion_rate=0.72,
                )
                action = pred.get("recommended_action", "send_reminder")
                logger.info(
                    "AI form prediction | token=%s action=%s prob=%.2f",
                    token_record.id,
                    action,
                    pred.get("completion_probability", 0),
                )
            except Exception as ai_exc:
                logger.debug("AI prediction skipped: %s — using default reminder", ai_exc)

            if action == "wait":
                logger.info("AI: skipping reminder for token %s (likely to complete)", token_record.id)
                continue

            form_url = f"{platform_url}/forms/{token_record.token}"
            sent = email_svc.send_form_reminder(
                to_email=token_record.recipient_email,
                client_id=client.id,
                client_name=client.full_name,
                assessment_type=client.pathway or "Assessment",
                form_url=form_url,
            )

            if sent or True:  # Mark as reminded even in dev (no API key)
                token_record.reminder_sent_at = datetime.now(timezone.utc)
                token_record.status = STATUS_REMINDED
                db.commit()
                logger.info(
                    "Reminder sent | client=%s token=%s email=%s action=%s",
                    client.id, token_record.id, token_record.recipient_email, action,
                )

    except Exception as exc:
        logger.error("Scheduler job failed: %s", exc)
    finally:
        db.close()


def dispatch_follow_up_forms() -> None:
    """Daily job: send follow-up forms that are now due."""
    db = SessionLocal()
    try:
        from app.models.follow_up_schedule import (
            FollowUpScheduleRecord,
            FOLLOWUP_STATUS_PENDING,
            FOLLOWUP_STATUS_DISPATCHED,
            FOLLOWUP_STATUS_FAILED,
        )
        from app.models.form_token import FormToken, STATUS_PENDING as TOKEN_PENDING
        import uuid as _uuid

        now = datetime.now(timezone.utc)
        due = (
            db.query(FollowUpScheduleRecord)
            .filter(
                FollowUpScheduleRecord.status == FOLLOWUP_STATUS_PENDING,
                FollowUpScheduleRecord.due_at <= now,
            )
            .all()
        )

        for fup in due:
            try:
                token_str = _uuid.uuid4().hex
                tok = FormToken(
                    id             = f"FTK-{_uuid.uuid4().hex[:8].upper()}",
                    token          = token_str,
                    client_id      = fup.client_id,
                    form_type      = f"follow_up_{fup.months_offset}m",
                    recipient_email = fup.recipient_email,
                    recipient_name = fup.client_name,
                    sent_at        = now,
                )
                db.add(tok)

                from app.core.config import settings
                platform_url = getattr(settings, "platform_base_url", "http://localhost:3004")
                form_url = f"{platform_url}/forms/{token_str}"

                import app.services.email as email_svc_mod
                email_svc_mod.send_form_reminder(
                    to_email       = fup.recipient_email,
                    client_id      = fup.client_id,
                    client_name    = fup.client_name or "Client",
                    assessment_type = f"{fup.months_offset}-month follow-up",
                    form_url       = form_url,
                )

                fup.status        = FOLLOWUP_STATUS_DISPATCHED
                fup.dispatched_at = now
                fup.form_token_id = tok.id
                db.commit()
                logger.info("Follow-up dispatched | fup=%s client=%s months=%s", fup.id, fup.client_id, fup.months_offset)
            except Exception as exc:
                fup.status = FOLLOWUP_STATUS_FAILED
                db.commit()
                logger.error("Follow-up dispatch failed | fup=%s: %s", fup.id, exc)

    except Exception as exc:
        logger.error("dispatch_follow_up_forms job failed: %s", exc)
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(
        check_overdue_forms,
        trigger="interval",
        hours=24,
        id="overdue_forms_reminder",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),
    )

    scheduler.add_job(
        dispatch_follow_up_forms,
        trigger="interval",
        hours=24,
        id="follow_up_dispatcher",
        replace_existing=True,
    )
    logger.info("Follow-up form dispatcher scheduled (every 24h)")

    # ── AI job worker — runs every 30 seconds to process queued AI jobs ───────
    try:
        from app.services.ai_workers import process_pending_jobs
        scheduler.add_job(
            process_pending_jobs,
            trigger="interval",
            seconds=30,
            id="ai_job_worker",
            replace_existing=True,
        )
        logger.info("AI job worker scheduled (every 30s)")
    except Exception as exc:
        logger.warning("Could not schedule AI job worker: %s", exc)

    scheduler.start()
    logger.info("Scheduler started - overdue form reminder job active (every 24h)")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
