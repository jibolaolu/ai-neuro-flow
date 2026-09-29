"""Add branding columns to organizations.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-01 00:00:00.000000

Adds the per-clinic branding columns that get_clinic_branding() reads.
Safe to run on an existing database — uses IF NOT EXISTS via batch_alter_table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import reflection

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    branding_cols = [
        ("display_name",               sa.String),
        ("support_email",              sa.String),
        ("contact_phone",              sa.String),
        ("address",                    sa.String),
        ("website",                    sa.String),
        ("logo_url",                   sa.String),
        ("registered_company_number",  sa.String),
        ("cqc_registration_number",    sa.String),
        ("ico_registration_number",    sa.String),
    ]

    for col_name, col_type in branding_cols:
        if not _column_exists("organizations", col_name):
            op.add_column(
                "organizations",
                sa.Column(col_name, col_type, nullable=True),
            )


def downgrade() -> None:
    for col_name in [
        "ico_registration_number",
        "cqc_registration_number",
        "registered_company_number",
        "logo_url",
        "website",
        "address",
        "contact_phone",
        "support_email",
        "display_name",
    ]:
        if _column_exists("organizations", col_name):
            op.drop_column("organizations", col_name)
