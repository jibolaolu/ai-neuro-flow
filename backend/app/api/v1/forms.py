"""
Forms API - public endpoints (no auth required, secured by token).
Handles form dispatch, retrieval, and submission.
"""

import json
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.services.tenant import get_client_for_user
from app.models.client import ClientRecord
from app.models.user import UserRecord
from app.models.client_profile import ClientProfileRecord
from app.models.form_token import (
    FORM_BASIC_INTAKE,
    FORM_ADULT_SELF,
    FORM_ADULT_GP,
    FORM_ADOLESCENT_SELF,
    FORM_ADOLESCENT_GP,
    FORM_ADOLESCENT_TEACHER,
    FORM_CHILD_GP,
    FORM_CHILD_PARENT,
    FORM_CHILD_TEACHER,
    FORM_TYPE_LABELS,
    STATUS_PENDING,
    STATUS_SUBMITTED,
    STATUS_REMINDED,
    FormInfo,
    FormToken,
    FormTokenOut,
    generate_token,
)
from app.services import email as email_svc
from app.services.scoring import (
    calculate_adult_scores,
    calculate_child_scores,
    calculate_adolescent_scores,
    calculate_teacher_scores,
)
from app.services.ai_report import generate_ai_report

router = APIRouter()


# ── Helper ─────────────────────────────────────────────────────────────────

def _get_platform_url() -> str:
    from app.core.config import settings
    return getattr(settings, "platform_base_url", "http://localhost:3004")


def _dispatch_form(
    db: Session,
    client_id: str,
    form_type: str,
    recipient_email: str,
    recipient_name: str,
    client_name: str,
    assessment_type: str,
    amount: str = "0",
    currency: str = "GBP",
    reference: str = "",
    paid_service_name: str | None = None,
) -> FormToken:
    """Create a form token and send the appropriate email."""
    form_id = str(uuid.uuid4())
    token = generate_token()
    form_url = f"{_get_platform_url()}/forms/{token}"

    record = FormToken(
        id=form_id,
        token=token,
        client_id=client_id,
        form_type=form_type,
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        status=STATUS_PENDING,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    if form_type == FORM_BASIC_INTAKE:
        # Paid checkout - welcome text, invoice, link to universal details form
        email_svc.send_welcome_and_forms(
            to_email=recipient_email,
            client_id=client_id,
            client_name=client_name,
            assessment_type=assessment_type,
            form_url=form_url,
            amount=amount,
            currency=currency,
            reference=reference,
        )
    elif form_type in (FORM_CHILD_PARENT, FORM_ADOLESCENT_SELF, FORM_ADULT_SELF):
        # Pathway questionnaire only (invoice already sent with basic intake)
        email_svc.send_secondary_intake_form(
            to_email=recipient_email,
            client_id=client_id,
            client_name=client_name,
            pathway_label=assessment_type,
            form_url=form_url,
            paid_service_name=paid_service_name,
        )
    else:
        # Third-party form (teacher, GP)
        email_svc.send_third_party_form(
            to_email=recipient_email,
            client_id=client_id,
            recipient_name=recipient_name,
            client_name=client_name,
            form_type_label=FORM_TYPE_LABELS.get(form_type, form_type),
            form_url=form_url,
        )

    return record


def _clean_str(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _pick_first(*values: object) -> str:
    for value in values:
        text = _clean_str(value)
        if text:
            return text
    return ""


class FormSubmitRequest(BaseModel):
    responses: dict
    teacher_email: str | None = None
    teacher_name: str | None = None
    gp_email: str | None = None
    gp_name: str | None = None
    gp_practice: str | None = None


def _extract_profile_fields(record: FormToken, payload: FormSubmitRequest) -> dict[str, str]:
    responses = payload.responses if isinstance(payload.responses, dict) else {}
    personal = responses.get("personal", {}) if isinstance(responses.get("personal"), dict) else {}
    child_details = (
        responses.get("child_details", {})
        if isinstance(responses.get("child_details"), dict)
        else {}
    )
    # adolescent_self form stores young person details under "young_person"
    young_person = (
        responses.get("young_person", {})
        if isinstance(responses.get("young_person"), dict)
        else {}
    )
    # parent screener questionnaire block (child and adolescent forms)
    parent_q = (
        responses.get("parent_questionnaire", {})
        if isinstance(responses.get("parent_questionnaire"), dict)
        else responses.get("parent_details", {})
        if isinstance(responses.get("parent_details"), dict)
        else {}
    )
    basic = responses.get("basic", {}) if isinstance(responses.get("basic"), dict) else {}

    # Merge child_details + young_person so lookups work for both form types
    child_or_yp = {**young_person, **child_details}

    date_of_birth = _pick_first(
        personal.get("dob"), child_or_yp.get("dob"), basic.get("dob"),
    )
    address = _pick_first(
        personal.get("address"), child_or_yp.get("home_address"), basic.get("address"),
    )
    phone = _pick_first(
        personal.get("phone"),
        child_or_yp.get("parent_phone"),
        parent_q.get("parent_phone"),
        basic.get("mobile"),
        basic.get("phone"),
    )
    gp_name = _pick_first(
        payload.gp_name,
        personal.get("gp_name"), child_or_yp.get("gp_name"), basic.get("gp_name"),
    )
    gp_practice = _pick_first(
        payload.gp_practice,
        personal.get("gp_practice"), child_or_yp.get("gp_practice"), basic.get("gp_practice"),
    )
    gp_email = _pick_first(
        payload.gp_email,
        personal.get("gp_email"), child_or_yp.get("gp_email"), basic.get("gp_email"),
    )
    teacher_name = _pick_first(payload.teacher_name, child_or_yp.get("teacher_name"))
    teacher_email = _pick_first(payload.teacher_email, child_or_yp.get("teacher_email"))
    school_name = _pick_first(child_or_yp.get("school"))
    parent_guardian_name = _pick_first(
        child_or_yp.get("parent_name"), parent_q.get("parent_name"),
    )
    parent_guardian_phone = _pick_first(
        child_or_yp.get("parent_phone"), parent_q.get("parent_phone"),
    )
    occupation = _pick_first(basic.get("occupation"))
    medical_concerns = _pick_first(
        basic.get("medical_concerns"),
        parent_q.get("other_medical_conditions"),
        child_or_yp.get("other_medical_conditions"),
    )
    ethnicity = _pick_first(
        child_or_yp.get("ethnicity"),
        personal.get("ethnicity"),
        basic.get("ethnicity"),
    )
    religion_group = _pick_first(
        child_or_yp.get("religion"),
        personal.get("religion"),
        basic.get("religion"),
    )
    preferred_language = _pick_first(
        child_or_yp.get("primary_language"),
        child_or_yp.get("language"),
        personal.get("preferred_language"),
        basic.get("preferred_language"),
    )

    return {
        "date_of_birth": date_of_birth,
        "address": address,
        "phone": phone,
        "gp_name": gp_name,
        "gp_practice": gp_practice,
        "gp_email": gp_email,
        "teacher_name": teacher_name,
        "teacher_email": teacher_email,
        "school_name": school_name,
        "parent_guardian_name": parent_guardian_name,
        "parent_guardian_phone": parent_guardian_phone,
        "occupation": occupation,
        "medical_concerns": medical_concerns,
        "ethnicity": ethnicity,
        "religion_group": religion_group,
        "preferred_language": preferred_language,
    }


def _merge_top_level_into_responses(payload: FormSubmitRequest) -> dict:
    """Persist GP/teacher fields inside JSON so backfills match live extraction."""
    r = dict(payload.responses) if isinstance(payload.responses, dict) else {}
    for block_key in ("child_details", "young_person"):
        cd = r.get(block_key)
        if isinstance(cd, dict):
            cd_m = {**cd}
            if payload.gp_email:
                cd_m.setdefault("gp_email", payload.gp_email)
            if payload.gp_name:
                cd_m.setdefault("gp_name", payload.gp_name)
            if payload.gp_practice:
                cd_m.setdefault("gp_practice", payload.gp_practice)
            if payload.teacher_email:
                cd_m.setdefault("teacher_email", payload.teacher_email)
            if payload.teacher_name:
                cd_m.setdefault("teacher_name", payload.teacher_name)
            r[block_key] = cd_m
    pers = r.get("personal")
    if isinstance(pers, dict):
        pers_m = {**pers}
        if payload.gp_email:
            pers_m.setdefault("gp_email", payload.gp_email)
        if payload.gp_name:
            pers_m.setdefault("gp_name", payload.gp_name)
        if payload.gp_practice:
            pers_m.setdefault("gp_practice", payload.gp_practice)
        r["personal"] = pers_m
    basic_b = r.get("basic")
    if isinstance(basic_b, dict):
        bm = {**basic_b}
        if payload.gp_email:
            bm.setdefault("gp_email", payload.gp_email)
        if payload.gp_name:
            bm.setdefault("gp_name", payload.gp_name)
        if payload.gp_practice:
            bm.setdefault("gp_practice", payload.gp_practice)
        r["basic"] = bm
    return r


def sync_client_profile_from_submitted_forms(
    db: Session,
    client: ClientRecord,
    *,
    commit: bool = True,
) -> None:
    """
    Rebuild client_profiles from every submitted form token (oldest → newest).
    Fills gaps for clients whose forms were submitted before profile extraction existed.
    """
    tokens = (
        db.query(FormToken)
        .filter(
            FormToken.client_id == client.id,
            FormToken.status == STATUS_SUBMITTED,
            FormToken.responses.isnot(None),
        )
        .order_by(FormToken.submitted_at.asc(), FormToken.sent_at.asc(), FormToken.id.asc())
        .all()
    )
    if not tokens:
        return

    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == client.id).first()
    if not profile:
        profile = ClientProfileRecord(client_id=client.id)
        db.add(profile)

    last_phone: str | None = None
    for record in tokens:
        raw = record.responses
        if not raw or not str(raw).strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        payload = FormSubmitRequest(responses=data)
        extracted = _extract_profile_fields(record, payload)
        for key, value in extracted.items():
            if value:
                setattr(profile, key, value)
        if extracted.get("phone"):
            last_phone = extracted["phone"]

    if last_phone:
        client.phone = last_phone

    if commit:
        db.commit()
    else:
        db.flush()


# ── Public endpoints ────────────────────────────────────────────────────────

class FormInfoResponse(BaseModel):
    token: str
    form_type: str
    form_label: str
    client_name: str
    client_email: str | None = None
    status: str
    prefill: dict = {}


def _dob_to_iso(dob_str: str) -> str:
    """
    Convert DOB to ISO YYYY-MM-DD for HTML date inputs.
    Handles DD/MM/YYYY (from PendingCheckout) and passes through YYYY-MM-DD already.
    """
    if not dob_str:
        return ""
    s = dob_str.strip()
    if len(s) >= 10 and s[4] == "-":
        # Already ISO - return as-is (take only first 10 chars)
        return s[:10]
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            dd, mm, yyyy = parts
            try:
                return f"{yyyy.zfill(4)}-{mm.zfill(2)}-{dd.zfill(2)}"
            except Exception:
                pass
    return s


@router.get("/info/{token}", response_model=FormInfoResponse)
def get_form_info(token: str, db: Session = Depends(get_db)) -> FormInfoResponse:
    """Called by the frontend form page to determine which form to render."""
    record = db.query(FormToken).filter(FormToken.token == token).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form link not found or expired")

    client = db.query(ClientRecord).filter(ClientRecord.id == record.client_id).first()
    client_email = client.email if client else None

    # For third-party forms (teacher/GP), show the child/young person's name,
    # not the parent's (billing) name.
    THIRD_PARTY_FORMS = {FORM_CHILD_TEACHER, FORM_CHILD_GP, FORM_ADOLESCENT_TEACHER, FORM_ADOLESCENT_GP}
    if client and record.form_type in THIRD_PARTY_FORMS:
        client_name = client.child_name or client.full_name
    else:
        client_name = client.full_name if client else "Client"

    # ── Build prefill data from all available sources ──────────────────────
    prefill: dict = {}
    if client:
        if client.full_name:
            prefill["full_name"] = client.full_name
        if client.email:
            prefill["email"] = client.email
        if client.phone:
            prefill["phone"] = client.phone
        # Child/adolescent details on the client record
        if client.child_name:
            prefill["child_name"] = client.child_name
        if client.child_dob:
            prefill["child_dob"] = _dob_to_iso(client.child_dob)

        # Pull from client profile if it exists
        profile = (
            db.query(ClientProfileRecord)
            .filter(ClientProfileRecord.client_id == client.id)
            .first()
        )
        if profile:
            if profile.date_of_birth:
                prefill["dob"] = _dob_to_iso(profile.date_of_birth)
            if profile.address:
                prefill["address"] = profile.address
            if profile.gp_name:
                prefill["gp_name"] = profile.gp_name
            if profile.gp_practice:
                prefill["gp_practice"] = profile.gp_practice
            if profile.gp_email:
                prefill["gp_email"] = profile.gp_email
            if profile.phone and not prefill.get("phone"):
                prefill["phone"] = profile.phone
            if profile.teacher_name:
                prefill["teacher_name"] = profile.teacher_name
            if profile.teacher_email:
                prefill["teacher_email"] = profile.teacher_email
            if profile.school_name:
                prefill["school_name"] = profile.school_name
            if profile.parent_guardian_name:
                prefill["parent_name"] = profile.parent_guardian_name
            if profile.parent_guardian_phone:
                prefill["parent_phone"] = profile.parent_guardian_phone

        # Fall back to PendingCheckout for any still-missing fields
        # (pre-payment data that may not have been captured in profile yet)
        try:
            from app.models.pending_checkout import PendingCheckout
            pending = (
                db.query(PendingCheckout)
                .filter(PendingCheckout.email == client.email)
                .order_by(PendingCheckout.created_at.desc())
                .first()
            )
            if pending:
                if not prefill.get("phone") and pending.phone:
                    prefill["phone"] = pending.phone
                if not prefill.get("dob") and pending.dob:
                    prefill["dob"] = _dob_to_iso(pending.dob)
                if not prefill.get("address") and pending.address:
                    prefill["address"] = pending.address
                # Parent name from PendingCheckout first_name + last_name
                if not prefill.get("parent_name"):
                    pc_first = (pending.first_name or "").strip()
                    pc_last = (pending.last_name or "").strip()
                    pc_parent_name = f"{pc_first} {pc_last}".strip()
                    if pc_parent_name:
                        prefill["parent_name"] = pc_parent_name
        except Exception:  # noqa: BLE001
            pass

    return FormInfoResponse(
        token=token,
        form_type=record.form_type,
        form_label=FORM_TYPE_LABELS.get(record.form_type, record.form_type),
        client_name=client_name,
        client_email=client_email,
        status=record.status,
        prefill=prefill,
    )


@router.post("/submit/{token}")
def submit_form(token: str, payload: FormSubmitRequest, db: Session = Depends(get_db)) -> dict:
    """Submit form responses. Triggers third-party form dispatch if emails provided."""
    record = db.query(FormToken).filter(FormToken.token == token).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form link not found")
    if record.status == STATUS_SUBMITTED:
        return {"received": True, "message": "Already submitted"}

    merged_responses = _merge_top_level_into_responses(payload)
    record.responses = json.dumps(merged_responses)
    record.status = STATUS_SUBMITTED
    record.submitted_at = datetime.now(timezone.utc)
    db.commit()

    client = db.query(ClientRecord).filter(ClientRecord.id == record.client_id).first()
    if not client:
        return {"received": True}

    sync_client_profile_from_submitted_forms(db, client)
    payload_merged = FormSubmitRequest(
        responses=merged_responses,
        teacher_email=payload.teacher_email,
        teacher_name=payload.teacher_name,
        gp_email=payload.gp_email,
        gp_name=payload.gp_name,
        gp_practice=payload.gp_practice,
    )
    extracted = _extract_profile_fields(record, payload_merged)

    if record.form_type == FORM_BASIC_INTAKE:
        basic_block = merged_responses.get("basic") if isinstance(merged_responses, dict) else {}
        if isinstance(basic_block, dict):
            new_name = _clean_str(basic_block.get("full_name"))
            if new_name:
                client.full_name = new_name
            db.commit()

        # After basic intake, find the next clinical form the client needs to complete.
        # Return its token so the frontend can redirect the client directly.
        next_record = (
            db.query(FormToken)
            .filter(
                FormToken.client_id == client.id,
                FormToken.form_type.in_([FORM_ADULT_SELF, FORM_CHILD_PARENT, FORM_ADOLESCENT_SELF]),
                FormToken.status == STATUS_PENDING,
            )
            .order_by(FormToken.sent_at.asc())
            .first()
        )
        if next_record:
            return {
                "received": True,
                "message": "Thank you - your details have been saved. Please complete the next section.",
                "next_form_token": next_record.token,
            }

    # ── Score calculation ─────────────────────────────────────────────────────
    if record.form_type == FORM_ADULT_SELF:
        _run_scoring_and_ai_report(db, client, merged_responses, pathway="adult")
    elif record.form_type == FORM_CHILD_PARENT:
        _run_scoring_and_ai_report(db, client, merged_responses, pathway="child")
    elif record.form_type == FORM_ADOLESCENT_SELF:
        _run_scoring_and_ai_report(db, client, merged_responses, pathway="adolescent")
    elif record.form_type in (FORM_CHILD_TEACHER, FORM_ADOLESCENT_TEACHER):
        _run_teacher_scoring(db, client, merged_responses)

    # Dispatch third-party forms if emails were provided in this submission
    age_group = (client.age_group or "").lower()
    is_child = age_group == "child" or (client.pathway and "child" in client.pathway.lower())
    is_adolescent = age_group == "adolescent"
    is_under_18 = is_child or is_adolescent

    # For third-party forms, use the child's name (not the billing/parent name).
    third_party_name = client.child_name or client.full_name if is_under_18 else client.full_name

    teacher_name = _pick_first(payload.teacher_name, extracted.get("teacher_name"))
    if payload.teacher_email and is_under_18:
        teacher_form_type = FORM_ADOLESCENT_TEACHER if is_adolescent else FORM_CHILD_TEACHER
        _dispatch_form(
            db=db,
            client_id=client.id,
            form_type=teacher_form_type,
            recipient_email=payload.teacher_email,
            recipient_name=teacher_name or "Teacher",
            client_name=third_party_name,
            assessment_type=client.pathway or "Assessment",
        )

    gp_name = _pick_first(payload.gp_name, extracted.get("gp_name"))
    if payload.gp_email:
        if is_child:
            gp_form_type = FORM_CHILD_GP
        elif is_adolescent:
            gp_form_type = FORM_ADOLESCENT_GP
        else:
            gp_form_type = FORM_ADULT_GP
        _dispatch_form(
            db=db,
            client_id=client.id,
            form_type=gp_form_type,
            recipient_email=payload.gp_email,
            recipient_name=gp_name or "GP",
            client_name=third_party_name,
            assessment_type=client.pathway or "Assessment",
        )

    # Check if all expected forms are now submitted
    _check_all_forms_complete(db, client)

    return {"received": True, "message": "Thank you - your form has been submitted successfully."}


def _run_scoring_and_ai_report(
    db: Session,
    client: ClientRecord,
    responses: dict,
    pathway: str = "adult",
) -> None:
    """
    Calculate instrument scores and generate AI clinical overview.
    Supports adult, child, and adolescent pathways.
    """
    try:
        if pathway == "child":
            scores = calculate_child_scores(responses)
        elif pathway == "adolescent":
            scores = calculate_adolescent_scores(responses)
        else:
            scores = calculate_adult_scores(responses)

        if not scores:
            return

        profile = db.query(ClientProfileRecord).filter(
            ClientProfileRecord.client_id == client.id
        ).first()
        if not profile:
            profile = ClientProfileRecord(client_id=client.id)
            db.add(profile)

        profile.scores = json.dumps(scores)
        db.flush()

        # Calculate approximate age from profile DOB
        age: int | None = None
        dob_str = profile.date_of_birth or client.child_dob or ""
        if dob_str:
            try:
                from datetime import date
                dob = date.fromisoformat(dob_str[:10])
                today = date.today()
                age = (today - dob).days // 365
            except ValueError:
                pass

        client_display_name = client.child_name or client.full_name
        ai_result = generate_ai_report(
            client_name=client_display_name,
            age=age,
            scores=scores,
            pathway=pathway,
        )
        profile.ai_clinical_report = json.dumps(ai_result)
        db.commit()

    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).error("Scoring/AI report failed: %s", exc)


def _run_teacher_scoring(
    db: Session,
    client: ClientRecord,
    responses: dict,
) -> None:
    """
    Calculate CTRS scores from a teacher form and merge them into the client's
    existing profile.scores (so the AI report can be regenerated with all data).
    """
    try:
        new_scores = calculate_teacher_scores(responses)
        if not new_scores:
            return

        profile = db.query(ClientProfileRecord).filter(
            ClientProfileRecord.client_id == client.id
        ).first()
        if not profile:
            profile = ClientProfileRecord(client_id=client.id)
            db.add(profile)

        # Merge into any existing scores dict
        existing: dict = {}
        if profile.scores:
            try:
                existing = json.loads(profile.scores)
            except (json.JSONDecodeError, TypeError):
                pass
        existing.update(new_scores)
        profile.scores = json.dumps(existing)
        db.commit()

    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).error("Teacher scoring failed: %s", exc)


def _check_all_forms_complete(db: Session, client: ClientRecord) -> None:
    """
    If all core forms for a client are submitted, update status and notify admin.
    GP forms (adult_gp, child_gp, adolescent_gp) are treated as optional extras
    and do NOT block the scheduling workflow.
    """
    GP_FORM_TYPES = {FORM_ADULT_GP, FORM_CHILD_GP, FORM_ADOLESCENT_GP}

    all_tokens = db.query(FormToken).filter(FormToken.client_id == client.id).all()
    if not all_tokens:
        return

    # Only core (non-GP) forms are required
    core_tokens = [t for t in all_tokens if t.form_type not in GP_FORM_TYPES]
    if not core_tokens:
        return

    pending = [t for t in core_tokens if t.status == STATUS_PENDING or t.status == STATUS_REMINDED]
    if pending:
        return

    # All submitted - update client (single status string + scheduling stage)
    client.status = "Forms Returned, Ready to Schedule"
    client.stage = "Scheduling"
    if not client.booking_access_token:
        client.booking_access_token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(client)

    from app.core.config import settings
    admin_email = getattr(settings, "admin_notification_email", "support@neuroflow.app")
    platform_url = _get_platform_url()
    email_svc.send_forms_complete_notification(
        admin_email=admin_email,
        client_name=client.full_name,
        client_id=client.id,
        assessment_type=client.pathway or "Assessment",
        platform_url=platform_url,
    )
    email_svc.send_slot_selection_invite(
        to_email=client.email,
        client_name=client.full_name,
        assessment_type=client.pathway or "Assessment",
        platform_url=platform_url,
        client_id=client.id,
        booking_token=client.booking_access_token,
    )


# ── Admin / clinician endpoints ──────────────────────────────────────────────

@router.get("/{form_id}/responses")
def get_form_responses(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin")
    ),
) -> dict:
    """
    Return form metadata + submitted responses for a specific form.
    Clinicians can only view forms for clients assigned to them.
    AI summary/scores are NOT included - those stay admin-only.
    """
    record = db.query(FormToken).filter(FormToken.id == form_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Form not found")

    client = db.query(ClientRecord).filter(ClientRecord.id == record.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Clinicians can only see forms for their assigned clients
    if current_user.role in ("clinician", "senior-clinician"):
        if client.assigned_clinician_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorised - client not assigned to you")

    responses: dict | None = None
    if record.responses and record.status == STATUS_SUBMITTED:
        try:
            raw = json.loads(record.responses)
            if isinstance(raw, dict):
                # Strip out numeric rating arrays - those are handled by the scores system.
                # Clinicians see qualitative / free-text data; scoring/AI stays admin-only.
                RATING_KEYS = {
                    "asrs_ratings", "phq9_ratings", "gad7_ratings", "wfirs_ratings",
                    "sdq_parent_ratings", "sdq_self_ratings", "cprs_ratings",
                    "ctrs_ratings", "conners_ratings",
                }
                responses = {k: v for k, v in raw.items() if k not in RATING_KEYS}
                # Summarise presence of rating arrays without exposing raw scores
                rating_summary: dict[str, str] = {}
                for key in RATING_KEYS:
                    if key in raw:
                        arr = raw[key]
                        count = len(arr) if isinstance(arr, list) else "?"
                        answered = sum(1 for x in arr if isinstance(x, (int, float)) and x >= 0) if isinstance(arr, list) else "?"
                        rating_summary[key] = f"{answered}/{count} items completed"
                if rating_summary:
                    responses["_rating_summary"] = rating_summary
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": record.id,
        "form_type": record.form_type,
        "form_label": FORM_TYPE_LABELS.get(record.form_type, record.form_type),
        "status": record.status,
        "recipient_email": record.recipient_email,
        "recipient_name": record.recipient_name,
        "sent_at": record.sent_at.isoformat() if record.sent_at else None,
        "submitted_at": record.submitted_at.isoformat() if record.submitted_at else None,
        "responses": responses,
    }


@router.get("/{form_id}/full-responses")
def get_form_full_responses(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(
        require_roles("clinical-admin", "super-platform-admin", "senior-clinician")
    ),
) -> dict:
    """
    Return full form responses including raw rating arrays.
    Admin / senior-clinician only - used by the Q&A modal.
    """
    record = db.query(FormToken).filter(FormToken.id == form_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Form not found")

    client = db.query(ClientRecord).filter(ClientRecord.id == record.client_id).first()
    # Senior-clinicians may only view their own clients
    if current_user.role == "senior-clinician":
        if not client or client.assigned_clinician_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorised")

    responses: dict | None = None
    if record.responses and record.status == STATUS_SUBMITTED:
        try:
            raw = json.loads(record.responses)
            if isinstance(raw, dict):
                responses = raw
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": record.id,
        "form_type": record.form_type,
        "form_label": FORM_TYPE_LABELS.get(record.form_type, record.form_type),
        "status": record.status,
        "recipient_email": record.recipient_email,
        "recipient_name": record.recipient_name,
        "sent_at": record.sent_at.isoformat() if record.sent_at else None,
        "submitted_at": record.submitted_at.isoformat() if record.submitted_at else None,
        "responses": responses,
    }


class ClientFormsResponse(BaseModel):
    client_id: str
    forms: list[FormTokenOut]
    all_submitted: bool


@router.get("/progress/{token}")
def get_form_progress(token: str, db: Session = Depends(get_db)) -> dict:
    """Returns the client's overall assessment journey progress for the forms portal."""
    record = db.query(FormToken).filter(FormToken.token == token).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")

    client = db.query(ClientRecord).filter(ClientRecord.id == record.client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    # All tokens for this client — ordered by sent_at
    all_tokens = (
        db.query(FormToken)
        .filter(FormToken.client_id == record.client_id)
        .order_by(FormToken.sent_at)
        .all()
    )

    steps = []
    any_active_seen = False
    for t in all_tokens:
        if t.status == STATUS_SUBMITTED:
            status_val = "complete"
        elif not any_active_seen:
            status_val = "active"
            any_active_seen = True
        else:
            status_val = "pending"

        steps.append({
            "key": t.id,
            "label": FORM_TYPE_LABELS.get(t.form_type, t.form_type),
            "status": status_val,
            "completed_at": t.submitted_at.isoformat() if t.submitted_at else None,
            "detail": f"Sent to {t.recipient_email}" if t.recipient_email else None,
        })

    # Add appointment step
    session_status = "pending"
    session_detail = None
    if client.confirmed_session_at:
        session_status = "complete" if not any_active_seen else "pending"
        session_detail = f"Booked: {client.confirmed_session_at[:10]}"

    steps.append({
        "key": "appointment",
        "label": "Assessment appointment",
        "status": session_status,
        "completed_at": client.confirmed_session_at,
        "detail": session_detail,
    })

    # Add report step
    from app.models.clinical_report import ClinicalReportRecord  # lazy import
    reports = db.query(ClinicalReportRecord).filter(ClinicalReportRecord.client_id == record.client_id).all()
    report_status = "pending"
    report_detail = None
    if reports:
        issued = [r for r in reports if r.status == "issued"]
        if issued:
            report_status = "complete"
            report_detail = f"Report issued {issued[0].updated_at.strftime('%d %b %Y') if issued[0].updated_at else ''}"
        else:
            report_status = "active"
            report_detail = f"Status: {reports[0].status}"

    steps.append({
        "key": "report",
        "label": "Assessment report",
        "status": report_status,
        "completed_at": None,
        "detail": report_detail,
    })

    complete_count = sum(1 for s in steps if s["status"] == "complete")
    overall_percent = round((complete_count / len(steps)) * 100) if steps else 0

    return {
        "client_name": client.full_name or client.child_name or "Client",
        "pathway": client.pathway or "Assessment",
        "steps": steps,
        "overall_percent": overall_percent,
    }


@router.get("/client/{client_id}", response_model=ClientFormsResponse)
def list_client_forms(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
            "senior-clinician",
            "clinician",
        ),
    ),
) -> ClientFormsResponse:
    get_client_for_user(db, user, client_id)
    tokens = db.query(FormToken).filter(FormToken.client_id == client_id).all()
    all_submitted = all(t.status == STATUS_SUBMITTED for t in tokens) if tokens else False

    return ClientFormsResponse(
        client_id=client_id,
        forms=[
            FormTokenOut(
                id=t.id,
                token=t.token,
                form_type=t.form_type,
                form_label=FORM_TYPE_LABELS.get(t.form_type, t.form_type),
                recipient_email=t.recipient_email,
                recipient_name=t.recipient_name,
                status=t.status,
                sent_at=t.sent_at,
                submitted_at=t.submitted_at,
            )
            for t in tokens
        ],
        all_submitted=all_submitted,
    )
