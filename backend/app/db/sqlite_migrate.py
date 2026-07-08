"""Best-effort SQLite ALTER TABLE for additive columns (no Alembic in this project)."""

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _sqlite_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def ensure_sqlite_columns(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.connect() as conn:
        try:
            ct = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'"),
            ).fetchone()
            if ct:
                cols = _sqlite_columns(conn, "clients")
                if "paid_service_name" not in cols:
                    conn.execute(text("ALTER TABLE clients ADD COLUMN paid_service_name VARCHAR"))
                    conn.commit()
                cols = _sqlite_columns(conn, "clients")
                for col, sql_typ in [
                    ("assigned_clinician_user_id", "VARCHAR"),
                    ("confirmed_session_at", "DATETIME"),
                    ("report_due_at", "DATETIME"),
                    ("booking_access_token", "VARCHAR"),
                ]:
                    if col not in cols:
                        conn.execute(text(f"ALTER TABLE clients ADD COLUMN {col} {sql_typ}"))
                        conn.commit()
        except Exception:
            conn.rollback()
        try:
            ut = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"),
            ).fetchone()
            if ut:
                cols = _sqlite_columns(conn, "users")
                for col, sql_typ in [
                    ("phone", "VARCHAR"),
                    ("address_line", "VARCHAR"),
                    ("date_of_birth", "VARCHAR"),
                ]:
                    if col not in cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {sql_typ}"))
                        conn.commit()
        except Exception:
            conn.rollback()
        try:
            cols = _sqlite_columns(conn, "client_profiles")
            if "occupation" not in cols:
                conn.execute(text("ALTER TABLE client_profiles ADD COLUMN occupation VARCHAR"))
                conn.commit()
            cols = _sqlite_columns(conn, "client_profiles")
            if "medical_concerns" not in cols:
                conn.execute(text("ALTER TABLE client_profiles ADD COLUMN medical_concerns TEXT"))
                conn.commit()
        except Exception:
            conn.rollback()
        try:
            avail_tbl = conn.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='clinician_availability_slots'"
                )
            ).fetchone()
            if avail_tbl:
                cols = _sqlite_columns(conn, "clinician_availability_slots")
                for col, sql_typ in [
                    ("admin_status", "VARCHAR"),
                    ("admin_comment", "VARCHAR"),
                    ("reviewed_by", "VARCHAR"),
                    ("reviewed_at", "DATETIME"),
                ]:
                    if col not in cols:
                        conn.execute(
                            text(
                                f"ALTER TABLE clinician_availability_slots ADD COLUMN {col} {sql_typ}"
                            )
                        )
                        conn.commit()
        except Exception:
            conn.rollback()
        # ── clinical_reports columns ─────────────────────────────────────────
        try:
            cr_tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='clinical_reports'")
            ).fetchone()
            if cr_tbl:
                cr_cols = _sqlite_columns(conn, "clinical_reports")
                for col, sql_typ in [
                    ("pdf_path", "VARCHAR"),
                    ("pdf_token", "VARCHAR"),
                    ("pdf_token_expires_at", "DATETIME"),
                    ("reviewed_by_id", "VARCHAR"),
                    ("reviewed_by_name", "VARCHAR"),
                    ("reviewed_at", "DATETIME"),
                    ("review_comment", "VARCHAR"),
                    ("submitted_at", "DATETIME"),
                    ("issued_at", "DATETIME"),
                    ("updated_at", "DATETIME"),
                    ("place_of_assessment", "VARCHAR"),
                    ("date_of_assessment", "VARCHAR"),
                    ("assessed_by", "VARCHAR"),
                ]:
                    if col not in cr_cols:
                        conn.execute(text(f"ALTER TABLE clinical_reports ADD COLUMN {col} {sql_typ}"))
                        conn.commit()
        except Exception:
            conn.rollback()
        # ── client_consents columns ──────────────────────────────────────────
        try:
            cc_tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='client_consents'")
            ).fetchone()
            if cc_tbl:
                cc_cols = _sqlite_columns(conn, "client_consents")
                for col, sql_typ in [
                    ("updated_by", "VARCHAR"),
                ]:
                    if col not in cc_cols:
                        conn.execute(text(f"ALTER TABLE client_consents ADD COLUMN {col} {sql_typ}"))
                        conn.commit()
        except Exception:
            conn.rollback()
        try:
            tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_requests'")
            ).fetchone()
            if tbl:
                cols = _sqlite_columns(conn, "invoice_requests")
                if "approval_status" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE invoice_requests ADD COLUMN approval_status VARCHAR DEFAULT 'pending'"
                        )
                    )
                    conn.commit()
                    conn.execute(
                        text(
                            "UPDATE invoice_requests SET approval_status = 'pending' WHERE approval_status IS NULL"
                        )
                    )
                    conn.commit()
                cols = _sqlite_columns(conn, "invoice_requests")
                if "reviewed_by_user_id" not in cols:
                    conn.execute(text("ALTER TABLE invoice_requests ADD COLUMN reviewed_by_user_id VARCHAR"))
                    conn.commit()
                cols = _sqlite_columns(conn, "invoice_requests")
                if "reviewed_at" not in cols:
                    conn.execute(text("ALTER TABLE invoice_requests ADD COLUMN reviewed_at DATETIME"))
                    conn.commit()
                cols = _sqlite_columns(conn, "invoice_requests")
                if "review_notes" not in cols:
                    conn.execute(text("ALTER TABLE invoice_requests ADD COLUMN review_notes TEXT"))
                    conn.commit()
        except Exception:
            conn.rollback()
        try:
            ct = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'"),
            ).fetchone()
            if ct:
                cols = _sqlite_columns(conn, "clients")
                if "clinic_id" not in cols:
                    conn.execute(text("ALTER TABLE clients ADD COLUMN clinic_id VARCHAR"))
                    conn.commit()
            cr_tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='clinical_reports'"),
            ).fetchone()
            if cr_tbl:
                cols = _sqlite_columns(conn, "clinical_reports")
                if "clinic_id" not in cols:
                    conn.execute(text("ALTER TABLE clinical_reports ADD COLUMN clinic_id VARCHAR"))
                    conn.commit()
        except Exception:
            conn.rollback()
        # ── support_tickets: guard additive columns after first run ──────────
        try:
            st_tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='support_tickets'"),
            ).fetchone()
            if st_tbl:
                st_cols = _sqlite_columns(conn, "support_tickets")
                for col, sql_typ in [
                    ("assigned_to_user_id", "VARCHAR"),
                    ("assigned_to_name", "VARCHAR"),
                    ("platform_response", "TEXT"),
                    ("resolved_at", "DATETIME"),
                    ("updated_at", "DATETIME"),
                    ("clinic_name", "VARCHAR"),
                    ("raised_by_name", "VARCHAR"),
                    ("raised_by_email", "VARCHAR"),
                ]:
                    if col not in st_cols:
                        conn.execute(
                            text(f"ALTER TABLE support_tickets ADD COLUMN {col} {sql_typ}")
                        )
                        conn.commit()
        except Exception:
            conn.rollback()
        # ── client_documents: OCR columns ────────────────────────────────────
        try:
            cd_tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='client_documents'"),
            ).fetchone()
            if cd_tbl:
                cd_cols = _sqlite_columns(conn, "client_documents")
                for col, sql_typ in [
                    ("ocr_text",   "TEXT"),
                    ("indexed_at", "DATETIME"),
                ]:
                    if col not in cd_cols:
                        conn.execute(text(f"ALTER TABLE client_documents ADD COLUMN {col} {sql_typ}"))
                        conn.commit()
        except Exception:
            conn.rollback()
        # ── ai_jobs / client_outcomes: new tables — create_all handles these,
        #    but guard additive columns for forward compatibility
        try:
            aj_tbl = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_jobs'"),
            ).fetchone()
            if aj_tbl:
                aj_cols = _sqlite_columns(conn, "ai_jobs")
                for col, sql_typ in [
                    ("clinic_id",    "VARCHAR"),
                    ("created_by",   "VARCHAR"),
                    ("started_at",   "DATETIME"),
                    ("completed_at", "DATETIME"),
                    ("error",        "TEXT"),
                ]:
                    if col not in aj_cols:
                        conn.execute(text(f"ALTER TABLE ai_jobs ADD COLUMN {col} {sql_typ}"))
                        conn.commit()
        except Exception:
            conn.rollback()
