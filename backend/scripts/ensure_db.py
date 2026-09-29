"""
Create the NeuroFlow PostgreSQL database if it does not already exist.

Run before `alembic upgrade head` on a fresh RDS instance:
    python scripts/ensure_db.py

Skips gracefully when DATABASE_URL points to SQLite (local dev).
"""
from __future__ import annotations

import os
import sys


def main() -> None:
    db_url = os.getenv("DATABASE_URL", "")

    if not db_url or db_url.startswith("sqlite"):
        print("SQLite or no DATABASE_URL — skipping ensure_db.")
        return

    # Parse host, port, user, password, dbname from the PostgreSQL URL
    # postgresql://user:password@host:port/dbname
    try:
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        host = parsed.hostname
        port = parsed.port or 5432
        user = parsed.username
        password = parsed.password
        dbname = parsed.path.lstrip("/")
    except Exception as exc:
        print(f"Could not parse DATABASE_URL: {exc}", file=sys.stderr)
        sys.exit(1)

    if not host:
        print("DB_HOST is absent — skipping ensure_db.")
        return

    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        print("psycopg2 not installed — ensure_db skipped.", file=sys.stderr)
        return

    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname="postgres",
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
    if cur.fetchone():
        print(f"Database '{dbname}' already exists.")
    else:
        cur.execute(f'CREATE DATABASE "{dbname}"')
        print(f"Database '{dbname}' created.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
