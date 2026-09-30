"""Baseline schema — represents the initial create_all() state.

Revision ID: 0001
Revises:
Create Date: 2026-07-01 00:00:00.000000

On a fresh PostgreSQL install, run:
    python scripts/ensure_db.py
    alembic upgrade head

On an existing SQLite dev database, the tables already exist. Alembic marks
this migration as applied without running DDL when you stamp with:
    alembic stamp 0001
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("email", sa.String, nullable=False, unique=True, index=True),
        sa.Column("full_name", sa.String, nullable=True),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("clinic_id", sa.String, nullable=True),
        sa.Column("organization_id", sa.String, nullable=True),
        sa.Column("phone", sa.String, nullable=True),
        sa.Column("address_line", sa.String, nullable=True),
        sa.Column("date_of_birth", sa.String, nullable=True),
        sa.Column("postcode", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── organizations ────────────────────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("display_name", sa.String, nullable=True),
        sa.Column("slug", sa.String, nullable=False, unique=True, index=True),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("support_email", sa.String, nullable=True),
        sa.Column("contact_phone", sa.String, nullable=True),
        sa.Column("address", sa.String, nullable=True),
        sa.Column("website", sa.String, nullable=True),
        sa.Column("logo_url", sa.String, nullable=True),
        sa.Column("registered_company_number", sa.String, nullable=True),
        sa.Column("cqc_registration_number", sa.String, nullable=True),
        sa.Column("ico_registration_number", sa.String, nullable=True),
        sa.Column("subscription_status", sa.String, default="trialing"),
        sa.Column("subscription_plan", sa.String, nullable=True),
        sa.Column("stripe_customer_id", sa.String, nullable=True, unique=True),
        sa.Column("stripe_subscription_id", sa.String, nullable=True, unique=True),
        sa.Column("trial_ends_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── clients ──────────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("email", sa.String, nullable=False, index=True),
        sa.Column("phone", sa.String, nullable=True),
        sa.Column("pathway", sa.String, nullable=True),
        sa.Column("age_group", sa.String, nullable=True),
        sa.Column("child_name", sa.String, nullable=True),
        sa.Column("child_dob", sa.String, nullable=True),
        sa.Column("status", sa.String, default="New"),
        sa.Column("stage", sa.String, default="Intake"),
        sa.Column("source", sa.String, default="manual"),
        sa.Column("stripe_session_id", sa.String, nullable=True, unique=True),
        sa.Column("payment_amount", sa.String, nullable=True),
        sa.Column("payment_currency", sa.String, nullable=True),
        sa.Column("assessment_id", sa.String, nullable=True),
        sa.Column("paid_service_name", sa.String, nullable=True),
        sa.Column("assigned_clinician_user_id", sa.String, nullable=True, index=True),
        sa.Column("confirmed_session_at", sa.DateTime, nullable=True),
        sa.Column("report_due_at", sa.DateTime, nullable=True),
        sa.Column(
            "booking_access_token", sa.String, nullable=True, unique=True, index=True
        ),
        sa.Column(
            "portal_magic_token", sa.String, nullable=True, unique=True, index=True
        ),
        sa.Column("portal_magic_token_expires_at", sa.DateTime, nullable=True),
        sa.Column(
            "portal_session_token", sa.String, nullable=True, unique=True, index=True
        ),
        sa.Column("portal_session_expires_at", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.String, default="true"),
        sa.Column("created_at", sa.DateTime, nullable=True),
        # Extended fields from FormRouter / form submission
        sa.Column("date_of_birth", sa.String, nullable=True),
        sa.Column("address", sa.String, nullable=True),
        sa.Column("gp_name", sa.String, nullable=True),
        sa.Column("gp_practice", sa.String, nullable=True),
        sa.Column("gp_email", sa.String, nullable=True),
        sa.Column("teacher_name", sa.String, nullable=True),
        sa.Column("teacher_email", sa.String, nullable=True),
        sa.Column("school_name", sa.String, nullable=True),
        sa.Column("parent_guardian_name", sa.String, nullable=True),
        sa.Column("parent_guardian_phone", sa.String, nullable=True),
        sa.Column("occupation", sa.String, nullable=True),
        sa.Column("medical_concerns", sa.String, nullable=True),
        sa.Column("ethnicity", sa.String, nullable=True),
        sa.Column("religion_group", sa.String, nullable=True),
        sa.Column("preferred_language", sa.String, nullable=True),
        sa.Column("session_reminder_sent", sa.Boolean, default=False),
        sa.Column("account_expires_at", sa.DateTime, nullable=True),
    )

    # ── form_tokens ───────────────────────────────────────────────────────────
    op.create_table(
        "form_tokens",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("token", sa.String, nullable=False, unique=True, index=True),
        sa.Column("client_id", sa.String, nullable=False, index=True),
        sa.Column("clinic_id", sa.String, nullable=True),
        sa.Column("form_type", sa.String, nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("used_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── clinical_reports ─────────────────────────────────────────────────────
    op.create_table(
        "clinical_reports",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("client_id", sa.String, nullable=False, index=True),
        sa.Column("clinic_id", sa.String, nullable=True),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("report_type", sa.String, nullable=True),
        sa.Column("content_json", sa.Text, nullable=True),
        sa.Column("pdf_token", sa.String, nullable=True, unique=True, index=True),
        sa.Column("pdf_path", sa.String, nullable=True),
        sa.Column("status", sa.String, default="draft"),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    # ── invoices ──────────────────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("client_id", sa.String, nullable=True),
        sa.Column("client_name", sa.String, nullable=False),
        sa.Column("client_email", sa.String, nullable=False),
        sa.Column("invoice_number", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=False),
        sa.Column("line_items_json", sa.Text, nullable=True),
        sa.Column("amount_gbp", sa.Float, nullable=False),
        sa.Column("vat_rate", sa.Float, default=0.0),
        sa.Column("total_gbp", sa.Float, nullable=False),
        sa.Column("status", sa.String, default="draft"),
        sa.Column("invoice_date", sa.DateTime, nullable=True),
        sa.Column("due_date", sa.DateTime, nullable=True),
        sa.Column("sent_at", sa.DateTime, nullable=True),
        sa.Column("paid_at", sa.DateTime, nullable=True),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("stripe_payment_link", sa.String, nullable=True),
        sa.Column("stripe_payment_intent", sa.String, nullable=True),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("user_id", sa.String, nullable=True),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("resource_type", sa.String, nullable=True),
        sa.Column("resource_id", sa.String, nullable=True),
        sa.Column("detail_json", sa.Text, nullable=True),
        sa.Column("ip_address", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── messages ─────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("sender_id", sa.String, nullable=True),
        sa.Column("recipient_id", sa.String, nullable=True),
        sa.Column("subject", sa.String, nullable=True),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("user_id", sa.String, nullable=True, index=True),
        sa.Column("type", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.String, nullable=True),
        sa.Column("link", sa.String, nullable=True),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── newsfeed_posts ────────────────────────────────────────────────────────
    op.create_table(
        "newsfeed_posts",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("author_id", sa.String, nullable=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("pinned", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── nps_surveys ───────────────────────────────────────────────────────────
    op.create_table(
        "nps_surveys",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("client_id", sa.String, nullable=True),
        sa.Column("score", sa.Integer, nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("submitted_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── policies ─────────────────────────────────────────────────────────────
    op.create_table(
        "policies",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=True),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("version", sa.String, nullable=True),
        sa.Column("effective_date", sa.Date, nullable=True),
        sa.Column("review_date", sa.Date, nullable=True),
        sa.Column("status", sa.String, default="draft"),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── hr_records ────────────────────────────────────────────────────────────
    op.create_table(
        "hr_records",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("user_id", sa.String, nullable=True, index=True),
        sa.Column("record_type", sa.String, nullable=False),
        sa.Column("data_json", sa.Text, nullable=True),
        sa.Column("status", sa.String, nullable=True),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    # ── second_opinions ────────────────────────────────────────────────────────
    op.create_table(
        "second_opinions",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("client_id", sa.String, nullable=True, index=True),
        sa.Column("requested_by", sa.String, nullable=True),
        sa.Column("reviewer_id", sa.String, nullable=True),
        sa.Column("status", sa.String, default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("decision", sa.String, nullable=True),
        sa.Column("decision_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    # ── system_settings ────────────────────────────────────────────────────────
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String, primary_key=True),
        sa.Column("value", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.Column("updated_by", sa.String, nullable=True),
    )

    # ── email_triage ──────────────────────────────────────────────────────────
    op.create_table(
        "email_triage",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("from_address", sa.String, nullable=True),
        sa.Column("subject", sa.String, nullable=True),
        sa.Column("body_preview", sa.Text, nullable=True),
        sa.Column("ai_category", sa.String, nullable=True),
        sa.Column("ai_summary", sa.Text, nullable=True),
        sa.Column("status", sa.String, default="unread"),
        sa.Column("assigned_to", sa.String, nullable=True),
        sa.Column("received_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── client_portal_messages ────────────────────────────────────────────────
    op.create_table(
        "client_portal_messages",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("client_id", sa.String, nullable=False, index=True),
        sa.Column("sender_type", sa.String, nullable=False),  # 'client' or 'staff'
        sa.Column("sender_id", sa.String, nullable=True),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    # ── waitlist_entries ──────────────────────────────────────────────────────
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("client_id", sa.String, nullable=True),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("email", sa.String, nullable=True),
        sa.Column("pathway", sa.String, nullable=True),
        sa.Column("priority", sa.String, default="standard"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String, default="waiting"),
        sa.Column("added_at", sa.DateTime, nullable=True),
        sa.Column("converted_at", sa.DateTime, nullable=True),
    )

    # ── rtc_referrals ─────────────────────────────────────────────────────────
    op.create_table(
        "rtc_referrals",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("clinic_id", sa.String, nullable=True, index=True),
        sa.Column("patient_name", sa.String, nullable=False),
        sa.Column("patient_dob", sa.String, nullable=True),
        sa.Column("patient_email", sa.String, nullable=True),
        sa.Column("patient_phone", sa.String, nullable=True),
        sa.Column("pathway", sa.String, nullable=True),
        sa.Column("priority", sa.String, default="routine"),
        sa.Column("gp_name", sa.String, nullable=True),
        sa.Column("gp_practice", sa.String, nullable=True),
        sa.Column("gp_email", sa.String, nullable=True),
        sa.Column("status", sa.String, default="pending"),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("acceptance_letter_sent", sa.Boolean, default=False),
        sa.Column("converted_client_id", sa.String, nullable=True),
        sa.Column("referred_date", sa.DateTime, nullable=True),
        sa.Column("accepted_at", sa.DateTime, nullable=True),
        sa.Column("rejected_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("rtc_referrals")
    op.drop_table("waitlist_entries")
    op.drop_table("client_portal_messages")
    op.drop_table("email_triage")
    op.drop_table("system_settings")
    op.drop_table("second_opinions")
    op.drop_table("hr_records")
    op.drop_table("policies")
    op.drop_table("nps_surveys")
    op.drop_table("newsfeed_posts")
    op.drop_table("notifications")
    op.drop_table("messages")
    op.drop_table("audit_logs")
    op.drop_table("invoices")
    op.drop_table("clinical_reports")
    op.drop_table("form_tokens")
    op.drop_table("clients")
    op.drop_table("organizations")
    op.drop_table("users")
