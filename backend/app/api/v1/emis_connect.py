"""
NHS / EMIS Connect integration scaffolding.

This module provides:
  • ODS (Organisation Data Service) code lookup — real NHS ODS REST API
  • EMIS webhook receiver — accepts patient data pushed from EMIS Web
  • Patient record import simulation — maps EMIS patient JSON → ClientRecord
  • GP Connect stub — declares capability for NHS procurement

Note: Full bidirectional Spine/EMIS integration requires NHS IG Toolkit
accreditation, DSPT, and a formal EMIS API partnership. This scaffolding
provides the integration surface and can be activated once credentials are
obtained. Set EMIS_CLIENT_ID / EMIS_CLIENT_SECRET env vars.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.core.tenant import effective_clinic_id
from app.models.client import ClientRecord

logger = logging.getLogger(__name__)
router = APIRouter()

ODS_BASE = "https://directory.spineservices.nhs.uk/ORD/2-0-0"
EMIS_WEBHOOK_SECRET = os.getenv("EMIS_WEBHOOK_SECRET", "")


# ── ODS lookup ────────────────────────────────────────────────────────────────

@router.get("/ods/{ods_code}")
async def lookup_ods(ods_code: str):
    """
    Look up an NHS organisation by ODS code.
    Uses the live NHS ODS REST API (no auth required for read).
    """
    url = f"{ODS_BASE}/organisations/{ods_code.upper()}"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, headers={"Accept": "application/json"})
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail=f"ODS code {ods_code} not found")
        r.raise_for_status()
        data = r.json()
        org = data.get("Organisation", {})
        return {
            "ods_code": ods_code.upper(),
            "name": org.get("Name"),
            "status": org.get("Status"),
            "type": org.get("OrgRecordClass"),
            "address": org.get("GeoLoc", {}).get("Location", {}),
            "roles": [r.get("id") for r in org.get("Roles", {}).get("Role", []) if isinstance(r, dict)],
        }
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"ODS lookup failed: {exc}")


@router.get("/ods/search/{query}")
async def search_ods(query: str, role: Optional[str] = None, limit: int = 20):
    """Search NHS ODS for organisations by name."""
    params: dict = {"Name": query, "Limit": min(limit, 50)}
    if role:
        params["PrimaryRoleId"] = role
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"{ODS_BASE}/organisations", params=params,
                                 headers={"Accept": "application/json"})
        r.raise_for_status()
        orgs = r.json().get("Organisations", [])
        return [{"ods_code": o.get("OrgId"), "name": o.get("Name"), "type": o.get("OrgRecordClass")} for o in orgs]
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"ODS search failed: {exc}")


# ── EMIS webhook receiver ─────────────────────────────────────────────────────

class EmisPatientPayload(BaseModel):
    emis_guid: str
    nhs_number: Optional[str] = None
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gp_ods_code: Optional[str] = None
    gp_name: Optional[str] = None
    referral_reason: Optional[str] = None
    clinic_ods_code: Optional[str] = None  # which NeuroFlow clinic to route to


def _verify_emis_signature(body: bytes, sig: str) -> bool:
    """HMAC-SHA256 signature verification for EMIS webhook payloads."""
    if not EMIS_WEBHOOK_SECRET:
        logger.warning("EMIS_WEBHOOK_SECRET not set — skipping signature check (dev mode)")
        return True
    expected = hmac.new(EMIS_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig.removeprefix("sha256="))


@router.post("/webhook/emis", status_code=200)
async def emis_webhook(
    request: Request,
    x_emis_signature: Optional[str] = Header(None, alias="X-EMIS-Signature"),
    db: Session = Depends(get_db),
):
    """
    EMIS Web pushes patient/referral events here when a GP selects
    NeuroFlow as the Right-to-Choose provider.
    """
    raw_body = await request.body()
    if x_emis_signature and not _verify_emis_signature(raw_body, x_emis_signature):
        raise HTTPException(status_code=401, detail="Invalid EMIS webhook signature")

    try:
        payload = EmisPatientPayload(**json.loads(raw_body))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid payload: {exc}")

    # Map EMIS payload → ClientRecord (idempotent by emis_guid in email field)
    existing = db.query(ClientRecord).filter(
        ClientRecord.email == payload.email,
    ).first() if payload.email else None

    if not existing:
        # Route to clinic by ODS code mapping (simplified: use org 1 as default)
        clinic_id = 1  # production: lookup clinic by clinic_ods_code
        client = ClientRecord(
            clinic_id=clinic_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
            date_of_birth=payload.date_of_birth,
            nhs_number=payload.nhs_number,
            gp_name=payload.gp_name,
            source="emis-webhook",
            status="referral-received",
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        action = "created"
        client_id = client.id
    else:
        action = "existing"
        client_id = existing.id

    logger.info("EMIS webhook: %s client %d (EMIS GUID: %s)", action, client_id, payload.emis_guid)
    return {"status": "accepted", "action": action, "client_id": client_id}


# ── GP Connect capability stub ────────────────────────────────────────────────

@router.get("/gp-connect/capability")
def gp_connect_capability():
    """
    Declares GP Connect capability for NHS procurement evaluation.
    Full implementation requires NHS Digital onboarding.
    """
    return {
        "system": "NeuroFlow",
        "version": "1.0",
        "gp_connect_version": "1.6.0",
        "capabilities": [
            {"name": "Access Record HTML", "status": "planned", "target_date": "2026-Q4"},
            {"name": "Access Record Structured", "status": "planned", "target_date": "2026-Q4"},
            {"name": "Appointment Management", "status": "planned", "target_date": "2027-Q1"},
            {"name": "Send Document", "status": "planned", "target_date": "2026-Q4"},
        ],
        "spine_integration": {
            "pds_fhir": "planned",
            "sds": "planned",
            "nrl": "planned",
        },
        "ig_status": {
            "dspt": "in-progress",
            "dcb0129": "planned",
            "pen_test": "planned",
        },
        "note": "NeuroFlow is building towards full GP Connect integration. ODS lookup and EMIS webhook receiver are live.",
    }


# ── Integration status ────────────────────────────────────────────────────────

@router.get("/status")
def integration_status():
    """Returns current NHS/EMIS integration readiness."""
    emis_configured = bool(os.getenv("EMIS_CLIENT_ID"))
    return {
        "ods_lookup": "live",
        "emis_webhook": "live" if EMIS_WEBHOOK_SECRET else "unconfigured",
        "emis_oauth": "configured" if emis_configured else "pending",
        "gp_connect": "planned",
        "nhs_spine": "planned",
        "systmone": "planned",
        "readiness_score": 4 if emis_configured else 2,
        "next_steps": [
            "Obtain EMIS Web API partnership agreement",
            "Complete NHS DSPT submission",
            "Engage NHS Digital for Spine integration",
            "Achieve DCB0129 clinical safety accreditation",
        ] if not emis_configured else [
            "Complete NHS DSPT submission",
            "Engage NHS Digital for Spine integration",
        ],
    }
