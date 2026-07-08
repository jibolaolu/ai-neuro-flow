"""Telehealth / video assessment room integration (Whereby embed)."""

import hashlib
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import UserRecord
from app.services.tenant import get_client_for_user

router = APIRouter()

_WHEREBY_API_KEY = os.getenv("WHEREBY_API_KEY", "")
_WHEREBY_API_URL = "https://api.whereby.dev/v1"


class RoomCreateBody(BaseModel):
    client_id:  str
    duration_minutes: int = 90


def _generate_deterministic_room_name(clinic_id: str, client_id: str) -> str:
    """Derive a stable room name so repeated calls return the same room."""
    raw = f"neuroflow-{clinic_id}-{client_id}"
    return "nf-" + hashlib.sha256(raw.encode()).hexdigest()[:12]


async def _create_whereby_room(room_name: str, duration_minutes: int) -> dict | None:
    if not _WHEREBY_API_KEY:
        return None
    try:
        import httpx
        end_date = (datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{_WHEREBY_API_URL}/meetings",
                headers={
                    "Authorization": f"Bearer {_WHEREBY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "endDate": end_date,
                    "fields": ["hostRoomUrl"],
                    "roomNamePrefix": room_name,
                    "roomMode": "normal",
                },
                timeout=10,
            )
            if r.status_code in (200, 201):
                return r.json()
    except Exception:  # noqa: BLE001
        pass
    return None


@router.post("/room")
async def create_or_get_room(
    body: RoomCreateBody,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> dict:
    """Create or retrieve a Whereby video room for a client session."""
    client = get_client_for_user(db, user, body.client_id)
    clinic_id = user.clinic_id or user.organization_id or "default"
    room_name = _generate_deterministic_room_name(clinic_id, body.client_id)

    whereby_data = await _create_whereby_room(room_name, body.duration_minutes)

    if whereby_data:
        return {
            "provider":       "whereby",
            "room_url":       whereby_data.get("roomUrl"),
            "host_room_url":  whereby_data.get("hostRoomUrl"),
            "embed_url":      whereby_data.get("roomUrl") + "?background=off&chat=off",
            "meeting_id":     whereby_data.get("meetingId"),
            "client_name":    client.full_name,
            "duration_minutes": body.duration_minutes,
        }

    # Fallback: return a Daily.co-style URL pattern or a placeholder
    fallback_url = f"https://meet.jit.si/neuroflow-{room_name}"
    return {
        "provider":       "jitsi_fallback",
        "room_url":       fallback_url,
        "host_room_url":  fallback_url,
        "embed_url":      fallback_url,
        "meeting_id":     room_name,
        "client_name":    client.full_name,
        "duration_minutes": body.duration_minutes,
        "note":           "Whereby API key not configured — using Jitsi fallback",
    }


@router.get("/room/{client_id}")
async def get_room(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> dict:
    """Get the video room for a client (creates if needed)."""
    client = get_client_for_user(db, user, client_id)
    clinic_id = user.clinic_id or user.organization_id or "default"
    room_name = _generate_deterministic_room_name(clinic_id, client_id)
    whereby_data = await _create_whereby_room(room_name, 90)

    if whereby_data:
        return {
            "provider":    "whereby",
            "room_url":    whereby_data.get("roomUrl"),
            "embed_url":   whereby_data.get("roomUrl") + "?background=off&chat=off",
            "client_name": client.full_name,
        }

    fallback_url = f"https://meet.jit.si/neuroflow-{room_name}"
    return {
        "provider":    "jitsi_fallback",
        "room_url":    fallback_url,
        "embed_url":   fallback_url,
        "client_name": client.full_name,
    }
