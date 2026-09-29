"""Add portal magic-link and session auth columns to clients.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-15 00:00:00.000000

Enables the client-facing portal (/client-portal/*) to authenticate via
time-limited magic links (48 h) that issue 7-day session tokens.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import reflection

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    portal_cols = [
        ("account_expires_at",              sa.DateTime),
        ("portal_magic_token",              sa.String),
        ("portal_magic_token_expires_at",   sa.DateTime),
        ("portal_session_token",            sa.String),
        ("portal_session_expires_at",       sa.DateTime),
    ]

    for col_name, col_type in portal_cols:
        if not _column_exists("clients", col_name):
            op.add_column(
                "clients",
                sa.Column(col_name, col_type, nullable=True),
            )

    # Unique indexes (only created if column is new)
    bind = op.get_bind()
    inspector = reflection.Inspector.from_engine(bind)
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("clients")}

    if "ix_clients_portal_magic_token" not in existing_indexes:
        op.create_index(
            "ix_clients_portal_magic_token",
            "clients",
            ["portal_magic_token"],
            unique=True,
            postgresql_where=sa.text("portal_magic_token IS NOT NULL"),
        )

    if "ix_clients_portal_session_token" not in existing_indexes:
        op.create_index(
            "ix_clients_portal_session_token",
            "clients",
            ["portal_session_token"],
            unique=True,
            postgresql_where=sa.text("portal_session_token IS NOT NULL"),
        )


def downgrade() -> None:
    op.drop_index("ix_clients_portal_session_token", "clients")
    op.drop_index("ix_clients_portal_magic_token", "clients")

    for col_name in [
        "portal_session_expires_at",
        "portal_session_token",
        "portal_magic_token_expires_at",
        "portal_magic_token",
        "account_expires_at",
    ]:
        if _column_exists("clients", col_name):
            op.drop_column("clients", col_name)
