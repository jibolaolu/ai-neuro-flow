"""Staff newsfeed — admin posts, clinical staff reads."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.newsfeed import (
    NewsfeedCreate,
    NewsfeedList,
    NewsfeedPost,
    NewsfeedPostOut,
    NewsfeedUpdate,
)
from app.models.user import UserRecord

router = APIRouter()

STAFF_ROLES = {
    "clinician",
    "senior-clinician",
    "clinical-admin",
    "super-platform-admin",
}

VISIBILITY_FOR_ROLE = {
    "clinician": {"all_staff", "clinicians_only"},
    "senior-clinician": {"all_staff", "clinicians_only"},
    "clinical-admin": {"all_staff", "clinicians_only", "admin_only"},
    "super-platform-admin": {"all_staff", "clinicians_only", "admin_only"},
}


def _can_see(user_role: str, visibility: str) -> bool:
    return visibility in VISIBILITY_FOR_ROLE.get(user_role, set())


@router.get("/", response_model=NewsfeedList)
def list_posts(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> NewsfeedList:
    if user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Not available")
    all_posts = (
        db.query(NewsfeedPost)
        .order_by(NewsfeedPost.pinned.desc(), NewsfeedPost.created_at.desc())
        .all()
    )
    visible = [p for p in all_posts if _can_see(user.role, p.visibility)]
    return NewsfeedList(
        items=[NewsfeedPostOut.model_validate(p) for p in visible], total=len(visible)
    )


@router.post("/", response_model=NewsfeedPostOut, status_code=201)
def create_post(
    body: NewsfeedCreate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> NewsfeedPostOut:
    post_id = f"NEWS-{uuid.uuid4().hex[:8].upper()}"
    post = NewsfeedPost(
        id=post_id,
        title=body.title.strip(),
        body=body.body.strip(),
        author_id=user.id,
        author_name=user.full_name,
        visibility=body.visibility,
        pinned=body.pinned,
        image_urls=json.dumps(body.image_urls) if body.image_urls else None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return NewsfeedPostOut.model_validate(post)


@router.patch("/{post_id}", response_model=NewsfeedPostOut)
def update_post(
    post_id: str,
    body: NewsfeedUpdate,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> NewsfeedPostOut:
    post = db.query(NewsfeedPost).filter(NewsfeedPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        if field == "image_urls" and val is not None:
            setattr(post, field, json.dumps(val))
        else:
            setattr(post, field, val)
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return NewsfeedPostOut.model_validate(post)


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("clinical-admin", "super-platform-admin")),
) -> None:
    post = db.query(NewsfeedPost).filter(NewsfeedPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
