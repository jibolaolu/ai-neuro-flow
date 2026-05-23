"""Client consent CRUD endpoints."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.consent import ClientConsentRecord, ConsentIn, ConsentOut
from app.models.user import UserRecord

router = APIRouter()


def _to_out(record: ClientConsentRecord) -> ConsentOut:
    try:
        consents: dict[str, bool] = json.loads(record.consents_json or "{}")
    except (json.JSONDecodeError, TypeError):
        consents = {}
    return ConsentOut(
        client_id=record.client_id,
        consents=consents,
        updated_at=record.updated_at,
    )


@router.get("/client/{client_id}", response_model=ConsentOut)
def get_consent(
    client_id: str,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> ConsentOut:
    record = db.query(ClientConsentRecord).filter(
        ClientConsentRecord.client_id == client_id
    ).first()
    if not record:
        # Return empty consent record
        return ConsentOut(client_id=client_id, consents={}, updated_at=None)
    return _to_out(record)


@router.put("/client/{client_id}", response_model=ConsentOut)
def upsert_consent(
    client_id: str,
    body: ConsentIn,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles(
        "clinician", "senior-clinician", "clinical-admin", "super-platform-admin"
    )),
) -> ConsentOut:
    record = db.query(ClientConsentRecord).filter(
        ClientConsentRecord.client_id == client_id
    ).first()
    now = datetime.now(timezone.utc)
    if record:
        record.consents_json = json.dumps(body.consents)
        record.updated_at = now
        record.updated_by = current_user.id
    else:
        record = ClientConsentRecord(
            id=str(uuid.uuid4()),
            client_id=client_id,
            consents_json=json.dumps(body.consents),
            updated_at=now,
            updated_by=current_user.id,
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return _to_out(record)
