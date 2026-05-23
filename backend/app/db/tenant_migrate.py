"""Backfill default organization and clinic_id for existing rows."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.config import settings
from app.models.organization import SUB_TRIALING

DEFAULT_ORG_ID = "CLINIC-001"
DEFAULT_ORG_SLUG = "demo-clinic"
DEFAULT_ORG_NAME = "Demo Clinic"


def ensure_default_organization(engine: Engine) -> None:
    from app.db.base import Base
    from app.db.sqlite_migrate import ensure_sqlite_columns

    Base.metadata.create_all(bind=engine)
    ensure_sqlite_columns(engine)

    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=settings.signup_trial_days)
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT id FROM organizations WHERE id = :id"),
            {"id": DEFAULT_ORG_ID},
        ).fetchone()
        if not exists:
            conn.execute(
                text(
                    """
                    INSERT INTO organizations (
                        id, name, slug, is_active, subscription_status,
                        subscription_plan, trial_ends_at, created_at
                    ) VALUES (
                        :id, :name, :slug, 1, :status,
                        NULL, :trial_ends, :created_at
                    )
                    """
                ),
                {
                    "id": DEFAULT_ORG_ID,
                    "name": DEFAULT_ORG_NAME,
                    "slug": DEFAULT_ORG_SLUG,
                    "status": SUB_TRIALING,
                    "trial_ends": trial_end.isoformat(),
                    "created_at": now.isoformat(),
                },
            )
            conn.commit()

        if engine.dialect.name == "sqlite":
            ct = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'"),
            ).fetchone()
            if ct:
                cols = {row[1] for row in conn.execute(text("PRAGMA table_info(clients)")).fetchall()}
                if "clinic_id" in cols:
                    conn.execute(
                        text(
                            "UPDATE clients SET clinic_id = :cid WHERE clinic_id IS NULL OR clinic_id = ''"
                        ),
                        {"cid": DEFAULT_ORG_ID},
                    )
                    conn.commit()
            cr = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='clinical_reports'"),
            ).fetchone()
            if cr:
                cols = {row[1] for row in conn.execute(text("PRAGMA table_info(clinical_reports)")).fetchall()}
                if "clinic_id" in cols:
                    conn.execute(
                        text(
                            """
                            UPDATE clinical_reports
                            SET clinic_id = (
                                SELECT clinic_id FROM clients
                                WHERE clients.id = clinical_reports.client_id
                            )
                            WHERE clinic_id IS NULL OR clinic_id = ''
                            """
                        ),
                    )
                    conn.commit()

        conn.execute(
            text("UPDATE users SET clinic_id = :cid WHERE clinic_id = 'CLINIC-001'"),
            {"cid": DEFAULT_ORG_ID},
        )
        conn.commit()
