"""Policy library — CRUD and AI generation."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.policy import (
    ROLES_BY_VISIBILITY,
    PolicyCreate,
    PolicyGenerateRequest,
    PolicyList,
    PolicyOut,
    PolicyRecord,
    PolicyUpdate,
    VISIBILITY_ALL_STAFF,
)
from app.models.user import UserRecord

router = APIRouter()


def _can_read(user_role: str, visibility: str) -> bool:
    return user_role in ROLES_BY_VISIBILITY.get(visibility, set())


def _assert_readable(user: UserRecord, record: PolicyRecord) -> None:
    if not _can_read(user.role, record.visibility):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.get("/", response_model=PolicyList)
def list_policies(
    category: str | None = None,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> PolicyList:
    all_records = db.query(PolicyRecord).order_by(PolicyRecord.updated_at.desc()).all()
    visible = [r for r in all_records if _can_read(user.role, r.visibility)]
    if category:
        visible = [r for r in visible if r.category == category]
    return PolicyList(items=[PolicyOut.model_validate(r) for r in visible], total=len(visible))


@router.get("/{policy_id}", response_model=PolicyOut)
def get_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> PolicyOut:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == policy_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Policy not found")
    _assert_readable(user, record)
    return PolicyOut.model_validate(record)


@router.post("/", response_model=PolicyOut, status_code=201)
def create_policy(
    body: PolicyCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> PolicyOut:
    record = PolicyRecord(
        id=f"POL-{uuid.uuid4().hex[:8].upper()}",
        title=body.title,
        description=body.description,
        category=body.category,
        visibility=body.visibility,
        content=body.content,
        version=body.version or "1.0",
        review_date=body.review_date,
        is_ai_generated=False,
        created_by_user_id=user.id,
        created_by_name=user.full_name,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return PolicyOut.model_validate(record)


@router.patch("/{policy_id}", response_model=PolicyOut)
def update_policy(
    policy_id: str,
    body: PolicyUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> PolicyOut:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == policy_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Policy not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(record, field, val)
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return PolicyOut.model_validate(record)


@router.delete("/{policy_id}", status_code=204)
def delete_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> None:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == policy_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(record)
    db.commit()


@router.post("/generate", response_model=PolicyOut, status_code=201)
def generate_policy(
    body: PolicyGenerateRequest,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> PolicyOut:
    """Use AI to generate a policy document."""
    try:
        from app.services.ai_service import get_ai_service
        ai = get_ai_service()
        prompt = f"Write a professional policy document titled '{body.title}'."
        if body.category:
            prompt += f" Category: {body.category}."
        if body.context:
            prompt += f" Additional context: {body.context}"
        prompt += " Format as clear sections with headings. Include purpose, scope, responsibilities, and procedures."
        content = ai.complete(prompt, max_tokens=1500)
    except Exception:
        content = f"# {body.title}\n\n*AI generation failed. Please edit this policy manually.*\n"

    record = PolicyRecord(
        id=f"POL-{uuid.uuid4().hex[:8].upper()}",
        title=body.title,
        category=body.category,
        visibility=body.visibility,
        content=content,
        version="1.0",
        is_ai_generated=True,
        created_by_user_id=user.id,
        created_by_name=user.full_name,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return PolicyOut.model_validate(record)
