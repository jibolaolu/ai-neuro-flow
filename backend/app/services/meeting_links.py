"""
Video meeting URL generation for confirmed assessments.

Priority order:
  1. Zoom Server-to-Server OAuth — if ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET are set
  2. STATIC_VIDEO_MEETING_URL — a recurring Zoom / Meet link set per clinic
  3. Jitsi (meet.jit.si) — unique room per assessment, no account needed
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)


def jitsi_room_url(assessment_id: str) -> str:
    """Public Jitsi room: neuroflow-{sanitized_assessment_id}."""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "-", assessment_id.strip())
    safe = re.sub(r"-+", "-", safe).strip("-") or "session"
    return f"https://meet.jit.si/neuroflow-{safe}"


def _zoom_create_meeting(
    *,
    topic: str,
    start_time_iso: str | None = None,
    duration_minutes: int = 90,
) -> str | None:
    """
    Create a Zoom meeting via Server-to-Server OAuth.
    Returns the join URL or None if creation fails.

    Set in .env:
        ZOOM_ACCOUNT_ID=...
        ZOOM_CLIENT_ID=...
        ZOOM_CLIENT_SECRET=...
    """
    try:
        from app.core.config import settings
        import base64
        import urllib.request
        import urllib.parse
        import json as _json

        if not settings.zoom_account_id or not settings.zoom_client_id or not settings.zoom_client_secret:
            return None

        # Step 1: Get OAuth token
        credentials = base64.b64encode(
            f"{settings.zoom_client_id}:{settings.zoom_client_secret}".encode()
        ).decode()
        token_url = (
            f"https://zoom.us/oauth/token"
            f"?grant_type=account_credentials"
            f"&account_id={urllib.parse.quote(settings.zoom_account_id)}"
        )
        token_req = urllib.request.Request(
            token_url,
            method="POST",
            headers={"Authorization": f"Basic {credentials}"},
        )
        with urllib.request.urlopen(token_req, timeout=8) as resp:
            token_data = _json.loads(resp.read())
        access_token = token_data.get("access_token")
        if not access_token:
            logger.warning("Zoom OAuth did not return access_token")
            return None

        # Step 2: Create meeting
        meeting_payload = {
            "topic": topic,
            "type": 2 if start_time_iso else 1,  # 2=scheduled, 1=instant
            "duration": duration_minutes,
            "settings": {
                "host_video": True,
                "participant_video": True,
                "join_before_host": True,
                "waiting_room": False,
                "auto_recording": "none",
            },
        }
        if start_time_iso:
            meeting_payload["start_time"] = start_time_iso

        meeting_body = _json.dumps(meeting_payload).encode()
        meeting_req = urllib.request.Request(
            "https://api.zoom.us/v2/users/me/meetings",
            data=meeting_body,
            method="POST",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(meeting_req, timeout=8) as resp:
            meeting_data = _json.loads(resp.read())
        join_url = meeting_data.get("join_url")
        if join_url:
            logger.info("Zoom meeting created: %s", join_url)
            return str(join_url)
        logger.warning("Zoom meeting created but no join_url in response")
        return None

    except Exception as exc:
        logger.warning("Zoom meeting creation failed (falling back): %s", exc)
        return None


def assessment_meeting_url(
    assessment_ref: str,
    *,
    topic: str | None = None,
    start_time_iso: str | None = None,
    duration_minutes: int = 90,
) -> str:
    """
    Video link for booking confirmation emails.

    1. Try Zoom Server-to-Server OAuth (creates a dedicated meeting per booking).
    2. Fall back to STATIC_VIDEO_MEETING_URL if set.
    3. Fall back to unique Jitsi room.
    """
    from app.core.config import settings

    # 1. Zoom per-session meeting
    zoom_url = _zoom_create_meeting(
        topic=topic or f"Neuro Flow Assessment – {assessment_ref}",
        start_time_iso=start_time_iso,
        duration_minutes=duration_minutes,
    )
    if zoom_url:
        return zoom_url

    # 2. Static recurring link (clinic-level Zoom / Meet)
    static_url = (settings.static_video_meeting_url or "").strip()
    if static_url:
        return static_url

    # 3. Jitsi fallback
    return jitsi_room_url(assessment_ref)
