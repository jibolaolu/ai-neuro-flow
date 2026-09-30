"""Platform system settings — key/value configuration store."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.system_setting import SystemSetting
from app.models.user import UserRecord

router = APIRouter()

_ADMIN_ROLES = ("clinical-admin", "super-platform-admin")


class SettingOut(BaseModel):
    key: str
    value: str
    updated_at: datetime | None
    updated_by: str | None

    model_config = {"from_attributes": True}


class SettingUpsert(BaseModel):
    value: str


@router.get("/", response_model=list[SettingOut])
def list_settings(
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> list[SettingOut]:
    require_roles(user, _ADMIN_ROLES)
    rows = db.query(SystemSetting).order_by(SystemSetting.key).all()
    return [SettingOut.model_validate(r) for r in rows]


@router.get("/{key}", response_model=SettingOut)
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(get_current_user),
) -> SettingOut:
    require_roles(user, _ADMIN_ROLES)
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    return SettingOut.model_validate(row)


@router.put("/{key}", response_model=SettingOut)
def upsert_setting(
    key: str,
    body: SettingUpsert,
    db: Session = Depends(get_db),
    user: UserRecord = Depends(require_roles("super-platform-admin")),
) -> SettingOut:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = body.value
        row.updated_by = user.id
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = SystemSetting(key=key, value=body.value, updated_by=user.id)
        db.add(row)
    db.commit()
    db.refresh(row)
    return SettingOut.model_validate(row)


@router.delete("/{key}", status_code=204, response_model=None)
def delete_setting(
    key: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("super-platform-admin")),
) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(row)
    db.commit()
