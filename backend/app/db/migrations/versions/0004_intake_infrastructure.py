"""Create clinic_webhook_configs and api_keys tables.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-29 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import reflection

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    return table in inspector.get_table_names()


def upgrade() -> None:
    if not _table_exists("clinic_webhook_configs"):
        op.create_table(
            "clinic_webhook_configs",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("clinic_id", sa.String, nullable=False, index=True),
            sa.Column("label", sa.String, nullable=False),
            sa.Column(
                "payload_format", sa.String, nullable=False, server_default="generic"
            ),
            sa.Column("signing_secret", sa.String, nullable=False),
            sa.Column("active", sa.Boolean, nullable=False, server_default="1"),
            sa.Column(
                "events_received", sa.Integer, nullable=False, server_default="0"
            ),
            sa.Column("last_event_at", sa.DateTime, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
        )
        op.create_index(
            "ix_clinic_webhook_configs_clinic_id",
            "clinic_webhook_configs",
            ["clinic_id"],
        )

    if not _table_exists("api_keys"):
        op.create_table(
            "api_keys",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("clinic_id", sa.String, nullable=False, index=True),
            sa.Column("label", sa.String, nullable=False),
            sa.Column("tier", sa.String, nullable=False, server_default="basic"),
            sa.Column("key_hash", sa.String, nullable=False, unique=True),
            sa.Column("key_prefix", sa.String, nullable=False),
            sa.Column("active", sa.Boolean, nullable=False, server_default="1"),
            sa.Column("requests_total", sa.Integer, nullable=False, server_default="0"),
            sa.Column("last_used_at", sa.DateTime, nullable=True),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.Column("created_by", sa.String, nullable=True),
        )
        op.create_index("ix_api_keys_clinic_id", "api_keys", ["clinic_id"])
        op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)


def downgrade() -> None:
    if _table_exists("api_keys"):
        op.drop_table("api_keys")
    if _table_exists("clinic_webhook_configs"):
        op.drop_table("clinic_webhook_configs")
