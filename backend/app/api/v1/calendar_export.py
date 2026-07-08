"""
Calendar export endpoints — iCal download, Google Calendar and Outlook links.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.form_token import FormToken
from app.models.user import UserRecord
from app.services.tenant import effective_clinic_id, get_client_for_user

router = APIRouter(redirect_slashes=False)

_CLINICAL_ROLES = ("clinician", "senior-clinician", "clinical-admin", "clinic-admin")


def _format_dt(dt: datetime) -> str:
    """iCal UTC datetime format."""
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _build_ical(
    *,
    uid: str,
    summary: str,
    description: str,
    location: str,
    start: datetime,
    end: datetime,
    organizer_email: str = "noreply@neuroflow.app",
) -> str:
    now = datetime.now(timezone.utc)
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Neuro Flow//Assessment Platform//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_format_dt(now)}",
        f"DTSTART:{_format_dt(start)}",
        f"DTEND:{_format_dt(end)}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description.replace(chr(10), '\\n')}",
        f"LOCATION:{location}",
        f"ORGANIZER:mailto:{organizer_email}",
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
    ])


def _google_link(*, summary: str, description: str, location: str, start: datetime, end: datetime) -> str:
    fmt = "%Y%m%dT%H%M%SZ"
    return (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={quote(summary)}"
        f"&dates={start.strftime(fmt)}/{end.strftime(fmt)}"
        f"&details={quote(description)}"
        f"&location={quote(location)}"
    )


def _outlook_link(*, summary: str, description: str, location: str, start: datetime, end: datetime) -> str:
    fmt = "%Y-%m-%dT%H:%M:%S"
    return (
        "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent"
        f"&subject={quote(summary)}"
        f"&startdt={start.strftime(fmt)}"
        f"&enddt={end.strftime(fmt)}"
        f"&body={quote(description)}"
        f"&location={quote(location)}"
    )


# ── Client appointment iCal (clinician access) ────────────────────────────────

@router.get("/clients/{client_id}/calendar.ics")
def client_appointment_ical(
    client_id: str,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """Download iCal file for a client's booked assessment session."""
    client = get_client_for_user(db, user, client_id)

    if not client.confirmed_session_at:
        raise HTTPException(404, "No confirmed appointment for this client")

    start = client.confirmed_session_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end   = start + timedelta(hours=2)

    clinician_name = getattr(client, "assigned_clinician_name", None) or "Your clinician"
    description = (
        f"Neuro Flow assessment appointment\n"
        f"Pathway: {client.pathway or 'ADHD/Autism'}\n"
        f"Clinician: {clinician_name}\n"
        f"Client: {client.full_name}\n"
        f"Please attend your online/in-person assessment at the confirmed location."
    )

    ical = _build_ical(
        uid         = f"{client_id}-assessment@neuroflow.app",
        summary     = f"Assessment — {client.full_name} ({client.pathway or 'ADHD'})",
        description = description,
        location    = "As confirmed in your booking email",
        start       = start,
        end         = end,
    )
    return PlainTextResponse(
        content = ical,
        media_type = "text/calendar",
        headers = {
            "Content-Disposition": f'attachment; filename="assessment-{client_id}.ics"'
        },
    )


@router.get("/clients/{client_id}/calendar-links")
def client_calendar_links(
    client_id: str,
    db:   Session    = Depends(get_db),
    user: UserRecord = Depends(require_roles(*_CLINICAL_ROLES)),
):
    """Return Google Calendar and Outlook links for a client's appointment."""
    client = get_client_for_user(db, user, client_id)
    if not client.confirmed_session_at:
        raise HTTPException(404, "No confirmed appointment for this client")

    start = client.confirmed_session_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end   = start + timedelta(hours=2)
    summary = f"Assessment — {client.pathway or 'ADHD/Autism Assessment'}"
    description = f"Neuro Flow assessment for {client.full_name}.\nPathway: {client.pathway or 'ADHD'}"

    return {
        "google": _google_link(summary=summary, description=description, location="As per booking confirmation", start=start, end=end),
        "outlook": _outlook_link(summary=summary, description=description, location="As per booking confirmation", start=start, end=end),
        "ical_path": f"/api/v1/clients/{client_id}/calendar.ics",
    }


# ── Client-facing: calendar links from form token ─────────────────────────────

@router.get("/public/appointment-links")
def public_appointment_links(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Returns calendar links using only a form token — no login required.
    Used on the forms page / booking confirmation page.
    """
    tok = db.query(FormToken).filter(FormToken.token == token).first()
    if not tok:
        raise HTTPException(404, "Token not found")

    client = db.query(ClientRecord).filter(ClientRecord.id == tok.client_id).first()
    if not client or not client.confirmed_session_at:
        raise HTTPException(404, "No appointment found")

    start = client.confirmed_session_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = start + timedelta(hours=2)

    summary = f"Assessment Appointment — {client.pathway or 'ADHD/Autism'}"
    description = (
        f"Your Neuro Flow {client.pathway or 'ADHD/Autism'} assessment.\n"
        f"Please ensure you attend on time and have completed all requested forms."
    )

    return {
        "appointment_time": start.isoformat(),
        "google":  _google_link(summary=summary, description=description, location="As per booking confirmation", start=start, end=end),
        "outlook": _outlook_link(summary=summary, description=description, location="As per booking confirmation", start=start, end=end),
    }
