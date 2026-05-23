"""
SendGrid email service.
Set SENDGRID_API_KEY in .env to enable real sending.
When the key is absent the email is logged to console only - safe for local dev.

Every attempt is persisted to email_send_logs (plain preview + truncated HTML) for clinic-admin review.
"""

import html as html_module
import logging
import re
import uuid
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)

from app.core.config import settings

COMPANY_NAME = settings.platform_display_name
COMPANY_EMAIL = settings.support_email
HTML_SNAPSHOT_MAX = 24000


def _html_to_plain_preview(html: str, max_len: int = 8000) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def _persist_email_send_log(
    *,
    client_id: str | None,
    template_key: str,
    recipient_email: str,
    subject: str,
    from_email: str,
    html_body: str,
    success: bool,
    delivery_mode: str,
    sendgrid_status_code: int | None,
    sendgrid_response_excerpt: str | None,
    error_message: str | None,
) -> None:
    from app.db.session import SessionLocal
    from app.models.email_send_log import EmailSendLog

    snap = html_body[:HTML_SNAPSHOT_MAX] if html_body else ""
    db = SessionLocal()
    try:
        db.add(
            EmailSendLog(
                id=str(uuid.uuid4()),
                client_id=client_id,
                template_key=template_key,
                recipient_email=recipient_email,
                subject=subject,
                from_email=from_email,
                body_preview=_html_to_plain_preview(html_body),
                html_snapshot=snap if snap else None,
                success=success,
                delivery_mode=delivery_mode,
                sendgrid_status_code=sendgrid_status_code,
                sendgrid_response_excerpt=sendgrid_response_excerpt,
                error_message=error_message,
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    except Exception as exc:
        logger.error("Failed to persist email_send_logs row: %s", exc)
        db.rollback()
    finally:
        db.close()


def _send(
    to_email: str,
    subject: str,
    html_body: str,
    *,
    client_id: str | None = None,
    template_key: str = "generic",
) -> bool:
    from app.core.config import settings

    api_key = getattr(settings, "sendgrid_api_key", "") or ""
    from_email = getattr(settings, "sendgrid_from_email", COMPANY_EMAIL)

    preview_log = _html_to_plain_preview(html_body, 480)
    logger.info(
        "Email payload | template=%s client_id=%s to=%s from=%s subject=%s | text_preview=%s",
        template_key,
        client_id,
        to_email,
        from_email,
        subject,
        preview_log,
    )

    if not api_key:
        logger.info(
            "[EMAIL - not sent, no API key] To: %s | Subject: %s",
            to_email,
            subject,
        )
        _persist_email_send_log(
            client_id=client_id,
            template_key=template_key,
            recipient_email=to_email,
            subject=subject,
            from_email=from_email,
            html_body=html_body,
            success=False,
            delivery_mode="no_api_key",
            sendgrid_status_code=None,
            sendgrid_response_excerpt=None,
            error_message="SENDGRID_API_KEY empty - configure backend/.env to deliver",
        )
        return False

    try:
        import sendgrid as sg_lib
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html_body,
        )
        sg_client = sg_lib.SendGridAPIClient(api_key)
        response = sg_client.send(message)
        sg_body = ""
        if getattr(response, "body", None):
            try:
                sg_body = response.body.decode("utf-8", errors="replace")[:1200]
            except Exception:
                sg_body = str(response.body)[:1200]
        if response.status_code not in (200, 202):
            logger.error(
                "SendGrid rejected mail | to=%s | status=%s | body=%s",
                to_email,
                response.status_code,
                sg_body or "(empty)",
            )
            _persist_email_send_log(
                client_id=client_id,
                template_key=template_key,
                recipient_email=to_email,
                subject=subject,
                from_email=from_email,
                html_body=html_body,
                success=False,
                delivery_mode="sendgrid_rejected",
                sendgrid_status_code=response.status_code,
                sendgrid_response_excerpt=sg_body or None,
                error_message=f"HTTP {response.status_code}",
            )
            return False
        logger.info(
            "Email sent via SendGrid | to=%s | status=%s",
            to_email,
            response.status_code,
        )
        _persist_email_send_log(
            client_id=client_id,
            template_key=template_key,
            recipient_email=to_email,
            subject=subject,
            from_email=from_email,
            html_body=html_body,
            success=True,
            delivery_mode="sendgrid",
            sendgrid_status_code=response.status_code,
            sendgrid_response_excerpt=sg_body or None,
            error_message=None,
        )
        return True
    except Exception as exc:
        logger.error("Email send failed to %s: %s", to_email, exc, exc_info=True)
        _persist_email_send_log(
            client_id=client_id,
            template_key=template_key,
            recipient_email=to_email,
            subject=subject,
            from_email=from_email,
            html_body=html_body,
            success=False,
            delivery_mode="exception",
            sendgrid_status_code=None,
            sendgrid_response_excerpt=None,
            error_message=str(exc)[:2000],
        )
        return False


# ── Invoice HTML ────────────────────────────────────────────────────────────

def _invoice_html(
    client_name: str,
    assessment_type: str,
    amount: str,
    currency: str,
    reference: str,
) -> str:
    today = date.today().strftime("%d %B %Y")
    return f"""
    <table style="width:100%;max-width:560px;border:1px solid #d9e1ee;border-radius:8px;
                  padding:24px;font-family:sans-serif;font-size:13px;color:#0f2147;">
      <tr><td colspan="2" style="padding-bottom:16px;border-bottom:2px solid #2a4db7;">
        <strong style="font-size:18px;color:#2a4db7;">{COMPANY_NAME}</strong><br>
        <small>neuroflow.app</small>
      </td></tr>
      <tr><td colspan="2" style="padding:12px 0 4px;">
        <strong>INVOICE / PAYMENT CONFIRMATION</strong>
      </td></tr>
      <tr><td style="padding:4px 0;color:#65748f;">Date</td><td>{today}</td></tr>
      <tr><td style="padding:4px 0;color:#65748f;">Reference</td><td style="font-family:monospace;">{reference}</td></tr>
      <tr><td style="padding:4px 0;color:#65748f;">Client</td><td>{client_name}</td></tr>
      <tr><td style="padding:4px 0;color:#65748f;">Service</td><td>{assessment_type}</td></tr>
      <tr><td style="padding:16px 0 4px;border-top:1px solid #d9e1ee;font-weight:700;">
        Amount paid
      </td><td style="padding:16px 0 4px;border-top:1px solid #d9e1ee;font-weight:700;font-size:16px;">
        {currency}{amount}
      </td></tr>
    </table>
    """


# ── Email templates ─────────────────────────────────────────────────────────

def send_welcome_and_forms(
    to_email: str,
    client_id: str,
    client_name: str,
    assessment_type: str,
    form_url: str,
    amount: str,
    currency: str,
    reference: str,
) -> bool:
    invoice = _invoice_html(client_name, assessment_type, amount, currency, reference)
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Welcome to {COMPANY_NAME}</h2>
      <p>Dear {client_name},</p>
      <p>Thank you for choosing <strong>{assessment_type}</strong>.
         Your payment has been received and your assessment journey has begun.</p>
      <p>Please complete your <strong>client information form</strong> using the link below first
         (about 5–10 minutes). You will receive a separate email with your service-specific
         assessment questionnaire.</p>
      <p style="margin:24px 0;">
        <a href="{form_url}"
           style="background:#2a4db7;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600;">
          Complete your client information form →
        </a>
      </p>
      <p style="font-size:13px;color:#65748f;">
        Or copy this link: <br>{form_url}
      </p>
      <p>If you have any questions, please contact us at
         <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
      <hr style="border:none;border-top:1px solid #d9e1ee;margin:32px 0;">
      <p style="font-size:12px;color:#65748f;">Payment confirmation</p>
      {invoice}
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} – client details and payment confirmation",
        html_body=html,
        client_id=client_id,
        template_key="welcome_and_forms",
    )


def send_secondary_intake_form(
    to_email: str,
    client_id: str,
    client_name: str,
    pathway_label: str,
    form_url: str,
    paid_service_name: str | None = None,
) -> bool:
    """Pathway-specific questionnaire link only (no invoice; welcome email covered payment)."""
    service_bit = (
        f"<strong>{html_module.escape(paid_service_name)}</strong> - "
        if paid_service_name
        else ""
    )
    safe_pathway = html_module.escape(pathway_label)
    safe_name = html_module.escape(client_name)
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Your assessment questionnaire</h2>
      <p>Dear {safe_name},</p>
      <p>{service_bit}Please complete your <strong>{safe_pathway}</strong> questionnaire using the link below.
         This helps us tailor your assessment. It usually takes about 15–20 minutes.</p>
      <p style="margin:24px 0;">
        <a href="{form_url}"
           style="background:#2a4db7;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600;">
          Complete questionnaire →
        </a>
      </p>
      <p style="font-size:13px;color:#65748f;">Or copy this link: <br>{form_url}</p>
      <p>If you have any questions, please contact us at
         <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} – questionnaire for your {pathway_label} assessment",
        html_body=html,
        client_id=client_id,
        template_key="secondary_intake_form",
    )


def send_form_reminder(
    to_email: str,
    client_id: str,
    client_name: str,
    assessment_type: str,
    form_url: str,
) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Gentle reminder - intake forms outstanding</h2>
      <p>Dear {client_name},</p>
      <p>We noticed your intake forms for your <strong>{assessment_type}</strong> are still outstanding.
         We need these before we can schedule your assessment.</p>
      <p>It only takes 15-20 minutes - please complete them at your earliest convenience.</p>
      <p style="margin:24px 0;">
        <a href="{form_url}"
           style="background:#2a4db7;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600;">
          Complete your intake form →
        </a>
      </p>
      <p>If you have any difficulty accessing the form, please contact us at
         <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"Reminder: {COMPANY_NAME} intake forms still needed",
        html_body=html,
        client_id=client_id,
        template_key="form_reminder",
    )


def send_third_party_form(
    to_email: str,
    client_id: str,
    recipient_name: str,
    client_name: str,
    form_type_label: str,
    form_url: str,
    requesting_organisation: str = COMPANY_NAME,
) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">{form_type_label} - information request</h2>
      <p>Dear {recipient_name},</p>
      <p>We are conducting a neurodevelopmental assessment for <strong>{client_name}</strong>
         on behalf of {requesting_organisation}.</p>
      <p>As part of this assessment, we would be grateful if you could complete a short
         questionnaire. This will take approximately 10 minutes and your responses will be
         treated in strict confidence.</p>
      <p style="margin:24px 0;">
        <a href="{form_url}"
           style="background:#2a4db7;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600;">
          Complete questionnaire →
        </a>
      </p>
      <p style="font-size:13px;color:#65748f;">Or copy this link: <br>{form_url}</p>
      <p>If you have any questions, please contact us at
         <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} - {form_type_label} for {client_name}",
        html_body=html,
        client_id=client_id,
        template_key="third_party_form",
    )


def send_forms_complete_notification(
    admin_email: str,
    client_name: str,
    client_id: str,
    assessment_type: str,
    platform_url: str,
) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">All forms returned - ready for scheduling</h2>
      <p>All intake forms for <strong>{client_name}</strong> ({client_id}) have been received.</p>
      <p>Assessment type: <strong>{assessment_type}</strong></p>
      <p>This client is now ready to be scheduled. Please log in to send available appointment slots.</p>
      <p style="margin:24px 0;">
        <a href="{platform_url}/clinic-admin/clients/{client_id}"
           style="background:#2a4db7;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600;">
          Open client record →
        </a>
      </p>
    </div>
    """
    return _send(
        to_email=admin_email,
        subject=f"Forms complete - {client_name} ready to schedule",
        html_body=html,
        client_id=client_id,
        template_key="forms_complete_admin",
    )


def send_slot_selection_invite(
    to_email: str,
    client_name: str,
    assessment_type: str,
    platform_url: str,
    client_id: str,
    booking_token: str,
) -> bool:
    """Sent to the client when all intake forms are back - next step is choosing an appointment slot."""
    base = platform_url.rstrip("/")
    book_url = f"{base}/book/{booking_token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Your forms are complete - book your assessment slot</h2>
      <p>Dear {client_name},</p>
      <p>Thank you - we have received all intake documentation for your
         <strong>{assessment_type}</strong>.</p>
      <p><strong>Next step:</strong> choose a time from your clinician&apos;s confirmed availability.
         If no times appear yet, please check back later or contact us.</p>
      <p style="margin:24px 0;">
        <a href="{book_url}"
           style="background:#2a4db7;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600;">
          Open booking / slot selection →
        </a>
      </p>
      <p style="font-size:13px;color:#65748f;">Reference: <span style="font-family:monospace;">{client_id}</span></p>
      <p>Questions? Contact <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} - choose your assessment slot",
        html_body=html,
        client_id=client_id,
        template_key="slot_selection_client",
    )


def send_booking_confirmation_client(
    to_email: str,
    client_id: str,
    client_name: str,
    pathway: str,
    slot_time: str,
    video_meeting_url: str,
    clinician_name: str,
) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Assessment confirmed</h2>
      <p>Dear {client_name},</p>
      <p>Your <strong>{pathway}</strong> assessment is confirmed.</p>
      <p><strong>When:</strong> {slot_time}<br>
         <strong>Clinician:</strong> {clinician_name}</p>
      <p><strong>Video session:</strong><br>
        <a href="{video_meeting_url}">{video_meeting_url}</a></p>
      <p>Please join a few minutes early and use a quiet space with a stable connection.</p>
      <p>If anything changes, contact <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} - assessment confirmation",
        html_body=html,
        client_id=client_id,
        template_key="booking_confirm_client",
    )


def send_booking_confirmation_clinician(
    to_email: str,
    client_id: str,
    clinician_name: str,
    client_name: str,
    pathway: str,
    slot_time: str,
    video_meeting_url: str,
) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Assessment booking confirmed</h2>
      <p>Dear {clinician_name},</p>
      <p><strong>Client:</strong> {client_name}<br>
         <strong>Pathway:</strong> {pathway}<br>
         <strong>Time:</strong> {slot_time}</p>
      <p><strong>Jitsi room:</strong><br>
        <a href="{video_meeting_url}">{video_meeting_url}</a></p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} - session with {client_name}",
        html_body=html,
        client_id=client_id,
        template_key="booking_confirm_clinician",
    )


def send_clinician_rota_week_confirmed(
    to_email: str,
    full_name: str,
    week_id: str,
    slot_count: int,
    admin_name: str,
) -> bool:
    """Notify a clinician that Clinical Admin has confirmed the weekly rota (availability + allocation context)."""
    safe_name = html_module.escape(full_name)
    safe_week = html_module.escape(week_id)
    safe_admin = html_module.escape(admin_name)
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;color:#0f2147;">
      <h2 style="color:#2a4db7;">Your weekly rota is confirmed</h2>
      <p>Dear {safe_name},</p>
      <p>Clinical Admin <strong>{safe_admin}</strong> has confirmed the rota for
         <strong>week {safe_week}</strong>.</p>
      <p><strong>{slot_count}</strong> availability slot(s) in this week are now marked as confirmed
         in Neuro Flow, so you can plan your sessions accordingly.</p>
      <p>If this looks wrong, contact the clinic operations desk or reply to
         <a href="mailto:{COMPANY_EMAIL}">{COMPANY_EMAIL}</a>.</p>
    </div>
    """
    return _send(
        to_email=to_email,
        subject=f"{COMPANY_NAME} – rota confirmed for week {week_id}",
        html_body=html,
        client_id=None,
        template_key="rota_week_confirmed",
    )


def notify_clinicians_rota_week_confirmed(
    db: object,
    week_id: str,
    admin_name: str,
) -> dict[str, int | str]:
    """
    Send one email per clinician with slots in this week. Push/mobile is not wired yet; extend here when ready.
    """
    from sqlalchemy.orm import Session

    from app.models.clinician_availability import ClinicianAvailabilitySlotRecord
    from app.models.user import UserRecord

    if not isinstance(db, Session):  # type: ignore[arg-type]
        return {"emails_sent": 0, "users_notified": 0, "push": "error"}

    slots: list[ClinicianAvailabilitySlotRecord] = (
        db.query(ClinicianAvailabilitySlotRecord)
        .filter(ClinicianAvailabilitySlotRecord.week_id == week_id, ClinicianAvailabilitySlotRecord.rota_status == "confirmed")
        .all()
    )
    if not slots:
        return {"emails_sent": 0, "users_notified": 0, "push": "deferred"}

    from collections import defaultdict

    by_user: dict[str, list[ClinicianAvailabilitySlotRecord]] = defaultdict(list)
    for s in slots:
        by_user[s.user_id].append(s)

    emails_sent = 0
    for uid, user_slots in by_user.items():
        u = db.query(UserRecord).filter(UserRecord.id == uid).first()
        if u and u.email and send_clinician_rota_week_confirmed(
            to_email=u.email,
            full_name=u.full_name,
            week_id=week_id,
            slot_count=len(user_slots),
            admin_name=admin_name,
        ):
            emails_sent += 1

    return {
        "emails_sent": emails_sent,
        "users_notified": len(by_user),
        "push": "deferred",
    }


# ── Report issued: client notification ────────────────────────────────────────

def send_report_issued(
    *,
    to_email: str,
    client_id: str,
    recipient_name: str,
    report_type: str,
    token_link: str,
    pdf_bytes: bytes | None = None,
    pdf_filename: str = "assessment-report.pdf",
) -> bool:
    """Send the completed assessment report to the client/parent with PDF attachment + token link."""
    from app.core.config import settings

    api_key = getattr(settings, "sendgrid_api_key", "") or ""
    from_email = getattr(settings, "sendgrid_from_email", COMPANY_EMAIL)
    subject = f"Your {report_type} Assessment Report is Ready"

    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#1d4ed8,#7c5cfc);padding:32px 40px">
        <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800">Your Assessment Report is Ready</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Neuro Flow Clinical Platform</p>
      </div>
      <div style="padding:32px 40px">
        <p style="color:#0f172a;font-size:15px">Dear {html_module.escape(recipient_name)},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">
          Your <strong>{html_module.escape(report_type)}</strong> assessment report has been completed and approved.
          It is attached to this email as a PDF.
        </p>
        <p style="color:#334155;font-size:14px;line-height:1.6">
          You can also view it securely online using the link below (available for 5 days):
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="{html_module.escape(token_link)}"
             style="background:linear-gradient(135deg,#1d4ed8,#7c5cfc);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
            View Report Online
          </a>
        </div>
        <p style="color:#64748b;font-size:12px;line-height:1.6">
          <strong>Please note:</strong> The online link expires after 5 days, but your PDF attachment is permanent.
          Keep this email for your records. If you have questions about your report, please contact the clinic.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:11px;text-align:center">
          This report is confidential and intended solely for the named recipient.
          Neuro Flow Clinical Platform &bull; Neuro Flow
        </p>
      </div>
    </div>
    """

    if api_key and pdf_bytes:
        # Send with PDF attachment via SendGrid
        try:
            import base64

            import sendgrid as sg_lib
            from sendgrid.helpers.mail import (
                Attachment,
                Disposition,
                FileContent,
                FileName,
                FileType,
                Mail,
            )

            message = Mail(
                from_email=from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_body,
            )
            encoded = base64.b64encode(pdf_bytes).decode()
            attachment = Attachment(
                FileContent(encoded),
                FileName(pdf_filename),
                FileType("application/pdf"),
                Disposition("attachment"),
            )
            message.attachment = attachment
            sg_client = sg_lib.SendGridAPIClient(api_key)
            response = sg_client.send(message)
            success = response.status_code in (200, 202)
            _persist_email_send_log(
                client_id=client_id,
                template_key="report_issued_client",
                recipient_email=to_email,
                subject=subject,
                from_email=from_email,
                html_body=html_body,
                success=success,
                delivery_mode="sendgrid_with_attachment",
                sendgrid_status_code=response.status_code,
                sendgrid_response_excerpt=None,
                error_message=None if success else f"HTTP {response.status_code}",
            )
            return success
        except Exception as exc:
            logger.error("Report email with attachment failed: %s", exc, exc_info=True)
            _persist_email_send_log(
                client_id=client_id,
                template_key="report_issued_client",
                recipient_email=to_email,
                subject=subject,
                from_email=from_email,
                html_body=html_body,
                success=False,
                delivery_mode="exception",
                sendgrid_status_code=None,
                sendgrid_response_excerpt=None,
                error_message=str(exc)[:2000],
            )
            return False

    # Fallback: plain email without attachment
    return _send(to_email, subject, html_body, client_id=client_id, template_key="report_issued_client")


# ── Report issued: clinician notification ─────────────────────────────────────

def send_report_issued_clinician_notification(
    *,
    to_email: str,
    clinician_name: str,
    client_name: str,
    report_type: str,
    report_id: str,
) -> bool:
    subject = f"Report Issued – {client_name} · {report_type}"
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#0f172a;padding:24px 32px">
        <h1 style="color:#fff;font-size:18px;margin:0;font-weight:800">Report Successfully Issued</h1>
        <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">Neuro Flow Clinical Platform</p>
      </div>
      <div style="padding:28px 32px">
        <p style="color:#0f172a;font-size:15px">Hi {html_module.escape(clinician_name)},</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">
          The following report has been approved and sent to the client:
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:16px 0">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:4px">Client</div>
          <div style="font-size:15px;color:#0f172a;font-weight:700">{html_module.escape(client_name)}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin:10px 0 4px">Report Type</div>
          <div style="font-size:14px;color:#0f172a">{html_module.escape(report_type)}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin:10px 0 4px">Report Reference</div>
          <div style="font-size:13px;color:#7c5cfc;font-family:monospace">{html_module.escape(report_id)}</div>
        </div>
        <p style="color:#64748b;font-size:13px">
          The PDF has been delivered to the client and a 5-day access link has been included.
          You can view the issued report in your Neuro Flow portal under Reports &rarr; Issued.
        </p>
      </div>
    </div>
    """
    return _send(
        to_email,
        subject,
        html_body,
        template_key="report_issued_clinician",
    )
