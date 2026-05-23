import secrets
import uuid
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from starlette.responses import FileResponse

from app.api.deps import get_current_user, get_db, require_roles
from app.services.tenant import (
    assert_client_tenant,
    clients_query,
    effective_clinic_id,
    get_client_for_user,
    is_platform_admin,
    require_clinic_member,
)
from app.core.config import document_upload_root, settings
from app.api.v1.forms import sync_client_profile_from_submitted_forms
from app.models.client import (
    ClientAssignBody,
    ClientClinicianOut,
    ClientList,
    ClientOut,
    ClientRecord,
)
from app.models.client_case_note import (
    CaseNoteCreate,
    CaseNoteList,
    CaseNoteOut,
    ClientCaseNoteRecord,
)
from app.models.client_document import ClientDocumentList, ClientDocumentOut, ClientDocumentRecord
from app.models.client_profile import ClientProfileRecord
from app.models.email_send_log import EmailSendLog, EmailSendLogList, EmailSendLogOut
from app.models.user import UserRecord
from app.services import email as email_svc

router = APIRouter()

MAX_DOCUMENT_BYTES = 20 * 1024 * 1024


class ClientCreateBody(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = ""
    pathway: str = "Adult ADHD"
    clinic_id: str | None = None  # required when super-platform-admin creates on behalf of a clinic

MIME_SUFFIX: dict[str, str] = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

EXT_MIME: dict[str, str] = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _resolve_mime_and_suffix(content_type: str | None, filename: str) -> tuple[str, str]:
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct in MIME_SUFFIX:
        return ct, MIME_SUFFIX[ct]
    suf = PurePosixPath(filename).suffix.lower()
    if suf == ".jpeg":
        suf = ".jpg"
    if suf in EXT_MIME:
        return EXT_MIME[suf], suf
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file type. Upload PDF, JPG, PNG, or DOCX.",
    )


def _document_to_out(rec: ClientDocumentRecord) -> ClientDocumentOut:
    suf = Path(rec.stored_rel_path).suffix.lower().removeprefix(".") or "bin"
    return ClientDocumentOut(
        id=rec.id,
        client_id=rec.client_id,
        title=rec.title,
        document_type=rec.document_type,
        file_type=suf.upper(),
        size_bytes=rec.size_bytes,
        uploaded_at=rec.created_at,
        uploaded_by=rec.uploaded_by_name,
        audience=rec.audience,
    )


def _assert_care_team_access(record: ClientRecord, user: UserRecord) -> None:
    assert_client_tenant(record, user)
    if user.role in ("clinical-admin", "super-platform-admin"):
        return
    if user.role in ("clinician", "senior-clinician"):
        if record.assigned_clinician_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this client",
            )
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def _to_client_out(
    record: ClientRecord,
    profile: ClientProfileRecord | None,
    clinician_name: str | None = None,
) -> ClientOut:
    return ClientOut(
        id=record.id,
        full_name=record.full_name,
        email=record.email,
        phone=record.phone,
        pathway=record.pathway,
        age_group=record.age_group,
        child_name=record.child_name,
        child_dob=record.child_dob,
        status=record.status,
        stage=record.stage,
        source=record.source,
        assessment_id=record.assessment_id,
        payment_amount=record.payment_amount,
        payment_currency=record.payment_currency,
        paid_service_name=record.paid_service_name,
        created_at=record.created_at,
        date_of_birth=profile.date_of_birth if profile else record.child_dob,
        address=profile.address if profile else None,
        gp_name=profile.gp_name if profile else None,
        gp_practice=profile.gp_practice if profile else None,
        gp_email=profile.gp_email if profile else None,
        teacher_name=profile.teacher_name if profile else None,
        teacher_email=profile.teacher_email if profile else None,
        school_name=profile.school_name if profile else None,
        parent_guardian_name=profile.parent_guardian_name if profile else None,
        parent_guardian_phone=profile.parent_guardian_phone if profile else None,
        occupation=profile.occupation if profile else None,
        medical_concerns=profile.medical_concerns if profile else None,
        ethnicity=profile.ethnicity if profile else None,
        religion_group=profile.religion_group if profile else None,
        preferred_language=profile.preferred_language if profile else None,
        assigned_clinician_user_id=record.assigned_clinician_user_id,
        assigned_clinician_name=clinician_name,
        confirmed_session_at=record.confirmed_session_at,
        report_due_at=record.report_due_at,
    )


def _to_clinician_out(record: ClientRecord, profile: ClientProfileRecord | None) -> ClientClinicianOut:
    return ClientClinicianOut(
        id=record.id,
        full_name=record.full_name,
        email=record.email,
        phone=record.phone,
        pathway=record.pathway,
        age_group=record.age_group,
        status=record.status,
        stage=record.stage,
        assessment_id=record.assessment_id,
        date_of_birth=profile.date_of_birth if profile else None,
        address=profile.address if profile else None,
        gp_name=profile.gp_name if profile else None,
        gp_practice=profile.gp_practice if profile else None,
        gp_email=profile.gp_email if profile else None,
        teacher_name=profile.teacher_name if profile else None,
        teacher_email=profile.teacher_email if profile else None,
        school_name=profile.school_name if profile else None,
        parent_guardian_name=profile.parent_guardian_name if profile else None,
        parent_guardian_phone=profile.parent_guardian_phone if profile else None,
        occupation=profile.occupation if profile else None,
        medical_concerns=profile.medical_concerns if profile else None,
        created_at=record.created_at,
        confirmed_session_at=record.confirmed_session_at,
        report_due_at=record.report_due_at,
    )


@router.get("/{client_id}/email-log", response_model=EmailSendLogList)
def get_client_email_log(
    client_id: str,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> EmailSendLogList:
    """Outbound email audit (Clinical Admin only - not exposed to clinicians)."""
    get_client_for_user(db, actor, client_id)

    rows = (
        db.query(EmailSendLog)
        .filter(EmailSendLog.client_id == client_id)
        .order_by(EmailSendLog.created_at.desc())
        .all()
    )
    return EmailSendLogList(
        items=[EmailSendLogOut.model_validate(r) for r in rows],
        total=len(rows),
    )


@router.get("/{client_id}/clinical", response_model=ClientClinicianOut)
def get_client_clinical_view(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinician", "senior-clinician")),
) -> ClientClinicianOut:
    """Care-relevant client profile for assigned clinicians (no billing or invoice fields)."""
    record = get_client_for_user(db, user, client_id)
    if record.assigned_clinician_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This client is not assigned to you",
        )
    sync_client_profile_from_submitted_forms(db, record)
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == record.id).first()
    return _to_clinician_out(record, profile)


@router.get("/{client_id}/care-record", response_model=ClientOut)
def get_client_care_record(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> ClientOut:
    """Full client record for tabbed UI (assigned clinicians + admins)."""
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)
    sync_client_profile_from_submitted_forms(db, record)
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == record.id).first()
    clinician_name: str | None = None
    if record.assigned_clinician_user_id:
        clin = db.query(UserRecord).filter(UserRecord.id == record.assigned_clinician_user_id).first()
        clinician_name = clin.full_name if clin else None
    return _to_client_out(record, profile, clinician_name=clinician_name)


@router.get("/{client_id}/case-notes", response_model=CaseNoteList)
def list_case_notes(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> CaseNoteList:
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)
    rows = (
        db.query(ClientCaseNoteRecord)
        .filter(ClientCaseNoteRecord.client_id == client_id)
        .order_by(ClientCaseNoteRecord.created_at.desc())
        .all()
    )
    return CaseNoteList(items=[CaseNoteOut.model_validate(r) for r in rows], total=len(rows))


@router.post("/{client_id}/case-notes", response_model=CaseNoteOut)
def create_case_note(
    client_id: str,
    body: CaseNoteCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> CaseNoteOut:
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)
    note_id = f"NOTE-{uuid.uuid4().hex[:10].upper()}"
    note = ClientCaseNoteRecord(
        id=note_id,
        client_id=client_id,
        author_user_id=user.id,
        author_name=user.full_name,
        body=body.body.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return CaseNoteOut.model_validate(note)


@router.get("/{client_id}/documents", response_model=ClientDocumentList)
def list_client_documents(
    client_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> ClientDocumentList:
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)
    rows = (
        db.query(ClientDocumentRecord)
        .filter(ClientDocumentRecord.client_id == client_id)
        .order_by(ClientDocumentRecord.created_at.desc())
        .all()
    )
    return ClientDocumentList(items=[_document_to_out(r) for r in rows], total=len(rows))


@router.post("/{client_id}/documents", response_model=ClientDocumentOut)
async def upload_client_document(
    client_id: str,
    title: str = Form(""),
    document_type: str = Form("Clinical report"),
    audience: str = Form("Shared"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> ClientDocumentOut:
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)

    original = PurePosixPath(file.filename or "document").name[:200] or "document"
    mime_type, suffix = _resolve_mime_and_suffix(file.content_type, original)
    title_clean = (title or "").strip() or (PurePosixPath(original).stem or "Document")

    root = document_upload_root()
    client_dir = root / client_id
    client_dir.mkdir(parents=True, exist_ok=True)
    stored_fs_name = f"{uuid.uuid4().hex}{suffix}"
    abs_path = (client_dir / stored_fs_name).resolve()
    rel_path = f"{client_id}/{stored_fs_name}"

    total = 0
    try:
        with abs_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DOCUMENT_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File too large (max {MAX_DOCUMENT_BYTES // (1024 * 1024)} MB)",
                    )
                out.write(chunk)
    except HTTPException:
        if abs_path.is_file():
            abs_path.unlink(missing_ok=True)
        raise
    except Exception:
        if abs_path.is_file():
            abs_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Could not store file") from None

    if total == 0:
        abs_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload")

    doc_id = f"DOC-{uuid.uuid4().hex[:10].upper()}"
    doc = ClientDocumentRecord(
        id=doc_id,
        client_id=client_id,
        title=title_clean[:500],
        document_type=(document_type or "Clinical report")[:120],
        stored_rel_path=rel_path,
        original_filename=original[:500],
        mime_type=mime_type,
        size_bytes=total,
        uploaded_by_user_id=user.id,
        uploaded_by_name=user.full_name or user.email,
        audience=(audience or "Shared")[:80],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _document_to_out(doc)


@router.get("/{client_id}/documents/{document_id}/file")
def download_client_document_file(
    client_id: str,
    document_id: str,
    download: bool = False,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles("clinician", "senior-clinician", "clinical-admin", "super-platform-admin"),
    ),
) -> FileResponse:
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)

    doc = (
        db.query(ClientDocumentRecord)
        .filter(
            ClientDocumentRecord.id == document_id,
            ClientDocumentRecord.client_id == client_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    root = document_upload_root().resolve()
    full_path = (root / doc.stored_rel_path).resolve()
    try:
        full_path.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from None
    if not full_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on server")

    return FileResponse(
        path=str(full_path),
        media_type=doc.mime_type,
        filename=doc.original_filename,
        content_disposition_type="attachment" if download else "inline",
    )


@router.post("/{client_id}/reminders/slot-selection", response_model=dict)
def resend_slot_selection_invite(
    client_id: str,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> dict:
    """Resend the client email with the personalised booking link (manual reminder)."""
    record = get_client_for_user(db, actor, client_id)
    if record.confirmed_session_at:
        raise HTTPException(status_code=400, detail="Client already has a confirmed session time")
    if record.status != "Forms Returned, Ready to Schedule":
        raise HTTPException(
            status_code=400,
            detail="Slot reminder only applies when status is 'Forms Returned, Ready to Schedule'",
        )
    if not record.booking_access_token:
        record.booking_access_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(record)

    platform_url = (settings.platform_base_url or "").rstrip("/") or "http://localhost:3004"
    ok = email_svc.send_slot_selection_invite(
        to_email=record.email,
        client_name=record.full_name,
        assessment_type=record.pathway or "Assessment",
        platform_url=platform_url,
        client_id=record.id,
        booking_token=record.booking_access_token,
    )
    return {"sent": ok}


@router.patch("/{client_id}/assignment", response_model=ClientOut)
def assign_clinician(
    client_id: str,
    body: ClientAssignBody,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> ClientOut:
    record = get_client_for_user(db, actor, client_id)
    if body.clinician_user_id is not None:
        u = db.query(UserRecord).filter(UserRecord.id == body.clinician_user_id).first()
        if not u:
            raise HTTPException(status_code=400, detail="Clinician user not found")
        if u.role not in ("clinician", "senior-clinician"):
            raise HTTPException(status_code=400, detail="User is not a clinician")
        if not is_platform_admin(actor) and u.clinic_id != actor.clinic_id:
            raise HTTPException(status_code=403, detail="Clinician not in your organization")
    record.assigned_clinician_user_id = body.clinician_user_id
    db.commit()
    db.refresh(record)
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == record.id).first()
    return _to_client_out(record, profile)


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client_manual(
    body: ClientCreateBody,
    db: Session = Depends(get_db),
    actor: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> ClientOut:
    """Add a client manually (no patient payment — clinic subscription covers platform use)."""
    if is_platform_admin(actor):
        cid = (body.clinic_id or "").strip() or None
        if not cid:
            raise HTTPException(status_code=400, detail="clinic_id required for platform admin")
    else:
        cid = require_clinic_member(actor)

    client_id = f"CLI-{uuid.uuid4().hex[:8].upper()}"
    assessment_id = f"ASS-{uuid.uuid4().hex[:8].upper()}"
    record = ClientRecord(
        id=client_id,
        clinic_id=cid,
        full_name=body.full_name.strip(),
        email=str(body.email).strip().lower(),
        phone=body.phone.strip() or None,
        pathway=body.pathway.strip() or "Adult ADHD",
        status="New",
        stage="Intake",
        source="manual",
        assessment_id=assessment_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_client_out(record, None)


@router.get("/", response_model=ClientList)
def list_clients(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(
        require_roles(
            "clinical-admin",
            "super-platform-admin",
            "senior-clinician",
            "clinician",
        ),
    ),
) -> ClientList:
    q = clients_query(db, user)
    if user.role in ("clinician", "senior-clinician"):
        q = q.filter(ClientRecord.assigned_clinician_user_id == user.id)
    records = q.order_by(ClientRecord.created_at.desc()).all()
    existing_profile_ids = {p.client_id for p in db.query(ClientProfileRecord).all()}
    for r in records:
        if r.id not in existing_profile_ids:
            sync_client_profile_from_submitted_forms(db, r, commit=False)
    db.commit()
    profiles = db.query(ClientProfileRecord).all()
    profile_by_client_id = {p.client_id: p for p in profiles}
    return ClientList(
        items=[_to_client_out(r, profile_by_client_id.get(r.id)) for r in records],
        total=len(records),
    )


@router.get("/{client_id}", response_model=ClientOut)
def get_client(
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
) -> ClientOut:
    record = get_client_for_user(db, user, client_id)
    _assert_care_team_access(record, user)
    sync_client_profile_from_submitted_forms(db, record)
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == record.id).first()
    clinician_name: str | None = None
    if record.assigned_clinician_user_id:
        clin = db.query(UserRecord).filter(UserRecord.id == record.assigned_clinician_user_id).first()
        clinician_name = clin.full_name if clin else None
    return _to_client_out(record, profile, clinician_name=clinician_name)


@router.get("/{client_id}/ai-report")
def get_ai_report(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinical-admin", "senior-clinician", "super-platform-admin")),
) -> dict:
    """Return the AI pre-assessment overview. Admin and senior clinician only."""
    import json as _json
    record = get_client_for_user(db, current_user, client_id)
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == client_id).first()
    if not profile or not profile.ai_clinical_report:
        return {"available": False}
    try:
        report = _json.loads(profile.ai_clinical_report)
        scores = _json.loads(profile.scores) if profile.scores else {}
    except Exception:
        return {"available": False}
    return {"available": True, "report": report, "scores": scores}


@router.post("/{client_id}/ai-report/regenerate")
def regenerate_ai_report(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("clinical-admin", "senior-clinician", "super-platform-admin")),
) -> dict:
    """Re-run the AI report from saved scores (e.g. after model upgrade)."""
    import json as _json
    from app.services.ai_report import generate_ai_report
    record = get_client_for_user(db, current_user, client_id)
    profile = db.query(ClientProfileRecord).filter(ClientProfileRecord.client_id == client_id).first()
    if not profile or not profile.scores:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No scores on file - client must submit their assessment form first",
        )
    scores = _json.loads(profile.scores)
    age: int | None = None
    dob_str = (profile.date_of_birth or "").strip()
    if dob_str:
        try:
            from datetime import date
            dob = date.fromisoformat(dob_str[:10])
            age = (date.today() - dob).days // 365
        except ValueError:
            pass
    # Infer pathway from which score keys are present
    if "asrs" in scores:
        pathway = "adult"
    elif "sdq" in scores and scores.get("sdq", {}).get("version") == "self":
        pathway = "adolescent"
    else:
        pathway = "child"
    client_display_name = record.child_name or record.full_name
    result = generate_ai_report(client_name=client_display_name, age=age, scores=scores, pathway=pathway)
    profile.ai_clinical_report = _json.dumps(result)
    db.commit()
    return {"available": True, "report": result, "scores": scores}
