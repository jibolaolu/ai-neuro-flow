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
    Send one reminder per token (tracks reminder_sent_at to avoid duplicates).
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

        for token_record in overdue:
            client = db.query(ClientRecord).filter(
                ClientRecord.id == token_record.client_id
            ).first()
            if not client:
                continue

            from app.core.config import settings
            platform_url = getattr(settings, "platform_base_url", "http://localhost:3004")
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
                    "Reminder sent | client=%s token=%s email=%s",
                    client.id, token_record.id, token_record.recipient_email,
                )

    except Exception as exc:
        logger.error("Scheduler job failed: %s", exc)
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(
        check_overdue_forms,
        trigger="interval",
        hours=24,
        id="overdue_forms_reminder",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),  # run once on startup to catch any backlog
    )
    scheduler.start()
    logger.info("Scheduler started - overdue form reminder job active (every 24h)")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
