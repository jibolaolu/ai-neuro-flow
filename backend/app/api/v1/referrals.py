"""Right to Choose / NHS referral intake API."""

from datetime import datetime, timezone
import json
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.client import ClientRecord
from app.models.rtc_referral import (
    PATHWAYS,
    RTC_STATUS_ACCEPTED,
    RTC_STATUS_CONVERTED,
    RTC_STATUS_PENDING,
    RTC_STATUS_REJECTED,
    RTCReferralRecord,
)
from app.models.user import UserRecord
from app.services import email as email_svc

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class RTCReferralCreate(BaseModel):
    patient_name:           str
    patient_dob:            str | None = None
    patient_nhs_number:     str | None = None
    patient_email:          str | None = None
    patient_phone:          str | None = None
    patient_address:        str | None = None
    gp_name:                str | None = None
    gp_practice:            str | None = None
    gp_email:               str | None = None
    icb_name:               str | None = None
    referrer_name:          str | None = None
    pathway:                str
    priority:               str = "routine"
    presenting_concerns:    str | None = None
    relevant_history:       str | None = None
    previous_assessments:   str | None = None
    referred_date:          str | None = None


class RTCAcceptBody(BaseModel):
    acceptance_notes:   str | None = None
    send_letter:        bool = True


class RTCRejectBody(BaseModel):
    rejection_reason:   str


class RTCConvertBody(BaseModel):
    """Convert an accepted referral into a client record."""
    clinician_user_id:  str | None = None
    clinic_id:          str | None = None   # override if not on token


class ParseLetterBody(BaseModel):
    letter_text: str   # raw pasted text of the GP referral letter


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clinic_id_from_user(user: UserRecord) -> str:
    return user.clinic_id or user.organization_id or "unknown"


def _send_acceptance_letter(referral: RTCReferralRecord) -> None:
    if not referral.gp_email and not referral.patient_email:
        return
    recipient = referral.gp_email or referral.patient_email
    try:
        email_svc.send_generic_notification(
            to_email=recipient,
            subject=f"Right to Choose Acceptance — {referral.patient_name}",
            body=(
                f"Dear {referral.gp_name or 'Referrer'},\n\n"
                f"We are pleased to confirm that we have accepted the Right to Choose referral "
                f"for {referral.patient_name} (DOB: {referral.patient_dob or 'not provided'}) "
                f"under the {referral.pathway} pathway.\n\n"
                f"We will be in touch with the patient shortly to begin the intake process.\n\n"
                f"Referral ID: {referral.id}\n\n"
                f"Regards,\nNeuro Flow Clinical Team"
            ),
        )
    except Exception:  # noqa: BLE001
        pass  # email send failure must not block the accept action


def _send_rejection_letter(referral: RTCReferralRecord) -> None:
    recipient = referral.gp_email or referral.patient_email
    if not recipient:
        return
    try:
        email_svc.send_generic_notification(
            to_email=recipient,
            subject=f"Right to Choose — Referral Update for {referral.patient_name}",
            body=(
                f"Dear {referral.gp_name or 'Referrer'},\n\n"
                f"Thank you for your Right to Choose referral for {referral.patient_name}.\n\n"
                f"Unfortunately, we are unable to accept this referral at this time.\n\n"
                f"Reason: {referral.rejection_reason}\n\n"
                f"Referral ID: {referral.id}\n\n"
                f"Regards,\nNeuro Flow Clinical Team"
            ),
        )
    except Exception:  # noqa: BLE001
        pass


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/pathways")
def list_pathways() -> dict:
    return {"pathways": PATHWAYS}


@router.post("/parse-letter")
def parse_gp_letter(
    body: ParseLetterBody,
    user: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "senior-clinician", "clinician"
    )),
) -> dict:
    """
    Use an LLM to extract structured fields from a pasted GP referral letter.
    Falls back to regex heuristics if the LLM is unavailable.
    """
    text = body.letter_text.strip()
    if len(text) < 20:
        raise HTTPException(400, detail="Letter text too short")

    # Try AI extraction first
    try:
        from app.ai.llm_gateway import llm_gateway
        prompt = (
            "You are a clinical admin assistant. Extract the following fields from the GP "
            "referral letter below and return ONLY a valid JSON object with these keys "
            "(use null for missing fields):\n"
            "patient_name, patient_dob (ISO date or null), patient_nhs_number, "
            "patient_email, patient_phone, patient_address, "
            "gp_name, gp_practice, gp_email, icb_name, "
            "pathway (one of: Adult ADHD, Adult Autism, Adult ADHD + Autism, "
            "Child ADHD, Child Autism, Child ADHD + Autism, Adolescent ADHD, Adolescent Autism), "
            "priority (routine or urgent), "
            "presenting_concerns (brief summary), referred_date (ISO date or null).\n\n"
            f"LETTER:\n{text[:3000]}"
        )
        raw = llm_gateway.simple_completion(prompt=prompt, max_tokens=600)
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            extracted = json.loads(json_match.group())
            # Sanitise pathway
            if extracted.get("pathway") not in PATHWAYS:
                extracted["pathway"] = PATHWAYS[0]
            return {"source": "ai", "fields": extracted}
    except Exception:  # noqa: BLE001
        pass

    # Regex heuristics fallback
    fields: dict = {k: None for k in [
        "patient_name", "patient_dob", "patient_nhs_number", "patient_email",
        "patient_phone", "patient_address", "gp_name", "gp_practice", "gp_email",
        "icb_name", "pathway", "priority", "presenting_concerns", "referred_date",
    ]}

    # NHS number — 10 digits, often spaced as 3-3-4
    nhs = re.search(r'\b(\d{3}\s*\d{3}\s*\d{4})\b', text)
    if nhs:
        fields["patient_nhs_number"] = nhs.group(1).replace(" ", "")

    # Email
    email = re.search(r'\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b', text, re.IGNORECASE)
    if email:
        fields["patient_email"] = email.group()

    # Phone
    phone = re.search(r'\b(?:\+44\s?|0)(?:\d[\s-]?){9,10}\b', text)
    if phone:
        fields["patient_phone"] = phone.group().strip()

    # DOB patterns: DD/MM/YYYY or DD Month YYYY
    dob = re.search(r'\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b', text)
    if dob:
        fields["patient_dob"] = f"{dob.group(3)}-{dob.group(2).zfill(2)}-{dob.group(1).zfill(2)}"

    # Pathway detection
    for p in PATHWAYS:
        if p.lower() in text.lower():
            fields["pathway"] = p
            break
    if not fields["pathway"]:
        fields["pathway"] = PATHWAYS[0]

    # Priority
    if re.search(r'\burgent\b', text, re.IGNORECASE):
        fields["priority"] = "urgent"
    else:
        fields["priority"] = "routine"

    return {"source": "heuristic", "fields": fields}


@router.get("/")
def list_referrals(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "senior-clinician", "clinician"
    )),
) -> dict:
    clinic_id = _clinic_id_from_user(user)
    q = db.query(RTCReferralRecord)
    if user.role not in ("super-platform-admin",):
        q = q.filter(RTCReferralRecord.clinic_id == clinic_id)
    if status:
        q = q.filter(RTCReferralRecord.status == status)
    rows = q.order_by(RTCReferralRecord.created_at.desc()).all()
    return {"items": [_row_out(r) for r in rows], "total": len(rows)}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_referral(
    body: RTCReferralCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "senior-clinician", "clinician"
    )),
) -> dict:
    if body.pathway not in PATHWAYS:
        raise HTTPException(400, detail=f"Unknown pathway. Valid: {PATHWAYS}")

    clinic_id = _clinic_id_from_user(user)
    referred_dt: datetime | None = None
    if body.referred_date:
        try:
            referred_dt = datetime.fromisoformat(body.referred_date)
        except ValueError:
            pass

    record = RTCReferralRecord(
        clinic_id=clinic_id,
        patient_name=body.patient_name,
        patient_dob=body.patient_dob,
        patient_nhs_number=body.patient_nhs_number,
        patient_email=body.patient_email,
        patient_phone=body.patient_phone,
        patient_address=body.patient_address,
        gp_name=body.gp_name,
        gp_practice=body.gp_practice,
        gp_email=body.gp_email,
        icb_name=body.icb_name,
        referrer_name=body.referrer_name,
        pathway=body.pathway,
        priority=body.priority,
        presenting_concerns=body.presenting_concerns,
        relevant_history=body.relevant_history,
        previous_assessments=body.previous_assessments,
        referred_date=referred_dt,
        created_by=user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _row_out(record)


@router.get("/{referral_id}")
def get_referral(
    referral_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles(
        "clinical-admin", "super-platform-admin", "senior-clinician", "clinician"
    )),
) -> dict:
    record = _get_or_404(db, referral_id)
    _check_clinic(record, user)
    return _row_out(record)


@router.post("/{referral_id}/accept")
def accept_referral(
    referral_id: str,
    body: RTCAcceptBody,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    record = _get_or_404(db, referral_id)
    _check_clinic(record, user)
    if record.status not in (RTC_STATUS_PENDING,):
        raise HTTPException(400, detail=f"Cannot accept referral in status '{record.status}'")

    record.status = RTC_STATUS_ACCEPTED
    record.eligibility_confirmed = True
    record.acceptance_notes = body.acceptance_notes
    record.accepted_at = datetime.now(timezone.utc)
    record.updated_at = datetime.now(timezone.utc)

    if body.send_letter:
        _send_acceptance_letter(record)
        record.acceptance_letter_sent = True

    db.commit()
    db.refresh(record)
    return _row_out(record)


@router.post("/{referral_id}/reject")
def reject_referral(
    referral_id: str,
    body: RTCRejectBody,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    record = _get_or_404(db, referral_id)
    _check_clinic(record, user)
    if record.status not in (RTC_STATUS_PENDING,):
        raise HTTPException(400, detail=f"Cannot reject referral in status '{record.status}'")

    record.status = RTC_STATUS_REJECTED
    record.rejection_reason = body.rejection_reason
    record.rejected_at = datetime.now(timezone.utc)
    record.updated_at = datetime.now(timezone.utc)

    _send_rejection_letter(record)

    db.commit()
    db.refresh(record)
    return _row_out(record)


@router.post("/{referral_id}/convert")
def convert_to_client(
    referral_id: str,
    body: RTCConvertBody,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Convert an accepted referral into a ClientRecord and mark as converted."""
    record = _get_or_404(db, referral_id)
    _check_clinic(record, user)
    if record.status != RTC_STATUS_ACCEPTED:
        raise HTTPException(400, detail="Only accepted referrals can be converted to clients.")
    if record.converted_client_id:
        raise HTTPException(400, detail="Referral already converted.")

    import uuid as _uuid
    clinic_id = _clinic_id_from_user(user)
    client = ClientRecord(
        id=f"CLT-{_uuid.uuid4().hex[:8].upper()}",
        full_name=record.patient_name,
        email=record.patient_email or "",
        pathway=record.pathway,
        clinic_id=body.clinic_id or clinic_id,
        assigned_clinician_user_id=body.clinician_user_id,
        gp_name=record.gp_name,
        gp_practice=record.gp_practice,
        status="Intake",
        referral_source="Right to Choose",
        date_of_birth=record.patient_dob,
    )
    db.add(client)
    db.flush()

    record.status = RTC_STATUS_CONVERTED
    record.converted_client_id = client.id
    record.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(record)
    return {"referral": _row_out(record), "client_id": client.id}


# ── Private helpers ────────────────────────────────────────────────────────────

def _get_or_404(db: Session, referral_id: str) -> RTCReferralRecord:
    r = db.query(RTCReferralRecord).filter(RTCReferralRecord.id == referral_id).first()
    if not r:
        raise HTTPException(404, detail="Referral not found")
    return r


def _check_clinic(record: RTCReferralRecord, user: UserRecord) -> None:
    if user.role == "super-platform-admin":
        return
    clinic_id = user.clinic_id or user.organization_id or ""
    if record.clinic_id != clinic_id:
        raise HTTPException(403, detail="Access denied")


def _row_out(r: RTCReferralRecord) -> dict:
    return {
        "id":                   r.id,
        "clinic_id":            r.clinic_id,
        "patient_name":         r.patient_name,
        "patient_dob":          r.patient_dob,
        "patient_nhs_number":   r.patient_nhs_number,
        "patient_email":        r.patient_email,
        "patient_phone":        r.patient_phone,
        "gp_name":              r.gp_name,
        "gp_practice":          r.gp_practice,
        "gp_email":             r.gp_email,
        "icb_name":             r.icb_name,
        "pathway":              r.pathway,
        "priority":             r.priority,
        "presenting_concerns":  r.presenting_concerns,
        "status":               r.status,
        "rejection_reason":     r.rejection_reason,
        "acceptance_notes":     r.acceptance_notes,
        "eligibility_confirmed":r.eligibility_confirmed,
        "acceptance_letter_sent": r.acceptance_letter_sent,
        "converted_client_id":  r.converted_client_id,
        "referred_date":        r.referred_date.isoformat() if r.referred_date else None,
        "accepted_at":          r.accepted_at.isoformat() if r.accepted_at else None,
        "rejected_at":          r.rejected_at.isoformat() if r.rejected_at else None,
        "created_at":           r.created_at.isoformat() if r.created_at else None,
    }
