"""FHIR R4 export endpoints for NHS system interoperability."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.client import ClientRecord
from app.models.rtc_referral import RTCReferralRecord
from app.models.user import UserRecord
from app.services.tenant import get_client_for_user

router = APIRouter()

FHIR_BASE = "https://neuroflow.health/fhir/R4"


def _fhir_timestamp(dt: datetime | None = None) -> str:
    d = dt or datetime.now(timezone.utc)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def _client_to_fhir_patient(client: ClientRecord) -> dict:
    name_parts = (client.full_name or "").split(" ", 1)
    given = name_parts[0] if name_parts else ""
    family = name_parts[1] if len(name_parts) > 1 else ""

    resource: dict = {
        "resourceType": "Patient",
        "id":           client.id,
        "meta": {
            "profile": ["https://fhir.hl7.org.uk/StructureDefinition/UKCore-Patient"],
            "lastUpdated": _fhir_timestamp(),
        },
        "identifier": [],
        "name": [{"use": "official", "family": family, "given": [given] if given else []}],
        "telecom": [],
        "extension": [
            {
                "url": "https://fhir.hl7.org.uk/StructureDefinition/Extension-UKCore-NHSNumberVerificationStatus",
                "valueCodeableConcept": {
                    "coding": [{"system": "https://fhir.hl7.org.uk/CodeSystem/UKCore-NHSNumberVerificationStatus", "code": "01"}]
                }
            }
        ],
    }

    if getattr(client, "nhs_number", None):
        resource["identifier"].append({
            "system": "https://fhir.nhs.uk/Id/nhs-number",
            "value":  client.nhs_number,
        })

    resource["identifier"].append({
        "system": f"{FHIR_BASE}/NamingSystem/patient-id",
        "value":  client.id,
    })

    if client.email:
        resource["telecom"].append({"system": "email", "value": client.email, "use": "home"})

    if getattr(client, "date_of_birth", None):
        resource["birthDate"] = str(client.date_of_birth)[:10]

    return resource


def _client_to_fhir_service_request(client: ClientRecord, referral: RTCReferralRecord | None = None) -> dict:
    pathway_snomed: dict[str, str] = {
        "Adult ADHD":           "406506008",
        "Adult Autism":         "35919005",
        "Adult ADHD + Autism":  "35919005",
        "Child ADHD":           "406506008",
        "Child Autism":         "35919005",
        "Adolescent ADHD":      "406506008",
        "Adolescent Autism":    "35919005",
    }
    snomed_code = pathway_snomed.get(client.pathway or "", "373942005")

    resource: dict = {
        "resourceType": "ServiceRequest",
        "id":           f"SR-{client.id}",
        "meta": {
            "profile": ["https://fhir.hl7.org.uk/StructureDefinition/UKCore-ServiceRequest"],
        },
        "status":  "active",
        "intent":  "order",
        "priority": "urgent" if (referral and referral.priority == "urgent") else "routine",
        "code": {
            "coding": [{
                "system":  "http://snomed.info/sct",
                "code":    snomed_code,
                "display": client.pathway or "Neurodevelopmental assessment",
            }]
        },
        "subject": {"reference": f"Patient/{client.id}"},
        "authoredOn": _fhir_timestamp(client.created_at if hasattr(client, "created_at") else None),
        "reasonCode": [],
    }

    if referral and referral.presenting_concerns:
        resource["reasonCode"].append({
            "text": referral.presenting_concerns
        })

    if referral and referral.gp_name:
        resource["requester"] = {
            "display": f"{referral.gp_name}" + (f" — {referral.gp_practice}" if referral.gp_practice else "")
        }

    return resource


def _make_bundle(resources: list[dict], bundle_type: str = "collection") -> dict:
    return {
        "resourceType": "Bundle",
        "id":           str(uuid.uuid4()),
        "type":         bundle_type,
        "timestamp":    _fhir_timestamp(),
        "meta": {
            "profile": ["https://fhir.hl7.org.uk/StructureDefinition/UKCore-Bundle"]
        },
        "entry": [
            {"fullUrl": f"{FHIR_BASE}/{r['resourceType']}/{r['id']}", "resource": r}
            for r in resources
        ],
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/Patient/{client_id}")
def fhir_patient(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
):
    client = get_client_for_user(db, user, client_id)
    return JSONResponse(
        content=_client_to_fhir_patient(client),
        media_type="application/fhir+json",
    )


@router.get("/ServiceRequest/{client_id}")
def fhir_service_request(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
):
    client = get_client_for_user(db, user, client_id)
    referral = (
        db.query(RTCReferralRecord)
        .filter(RTCReferralRecord.converted_client_id == client_id)
        .first()
    )
    return JSONResponse(
        content=_client_to_fhir_service_request(client, referral),
        media_type="application/fhir+json",
    )


@router.get("/Bundle/{client_id}")
def fhir_bundle(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
):
    """Full FHIR R4 Bundle for a client — Patient + ServiceRequest."""
    client = get_client_for_user(db, user, client_id)
    referral = (
        db.query(RTCReferralRecord)
        .filter(RTCReferralRecord.converted_client_id == client_id)
        .first()
    )
    bundle = _make_bundle([
        _client_to_fhir_patient(client),
        _client_to_fhir_service_request(client, referral),
    ])
    return JSONResponse(content=bundle, media_type="application/fhir+json")


@router.get("/CapabilityStatement")
def fhir_capability_statement():
    """FHIR R4 CapabilityStatement — declares supported resources for NHS procurement."""
    return JSONResponse(
        content={
            "resourceType": "CapabilityStatement",
            "id":           "neuroflow-fhir-r4",
            "status":       "active",
            "date":         datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "publisher":    "Neuro Flow Health",
            "kind":         "instance",
            "software":     {"name": "Neuro Flow", "version": "2.0"},
            "fhirVersion":  "4.0.1",
            "format":       ["application/fhir+json"],
            "rest": [{
                "mode": "server",
                "resource": [
                    {"type": "Patient",        "interaction": [{"code": "read"}]},
                    {"type": "ServiceRequest", "interaction": [{"code": "read"}]},
                    {"type": "Bundle",         "interaction": [{"code": "read"}]},
                ],
            }],
        },
        media_type="application/fhir+json",
    )
