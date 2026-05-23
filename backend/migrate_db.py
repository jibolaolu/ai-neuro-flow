"""
One-time migration script.
Adds missing columns/tables that create_all() won't add to existing DBs.
Safe to run multiple times.
"""
import sqlite3

db_path = "neuro_flow.db"
con = sqlite3.connect(db_path)
cur = con.cursor()

# ── clients table ─────────────────────────────────────────────────────────────
cur.execute("PRAGMA table_info(clients)")
existing_cols = [row[1] for row in cur.fetchall()]
print("clients columns:", existing_cols)

for col, typedef in [("child_name", "TEXT"), ("child_dob", "TEXT")]:
    if col not in existing_cols:
        cur.execute(f"ALTER TABLE clients ADD COLUMN {col} {typedef}")
        print(f"  Added column: clients.{col}")
    else:
        print(f"  Already exists: clients.{col}")

# ── pending_checkouts table ───────────────────────────────────────────────────
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_checkouts'")
if not cur.fetchone():
    cur.execute("""
        CREATE TABLE pending_checkouts (
            id TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            email TEXT NOT NULL,
            phone TEXT,
            dob TEXT,
            address TEXT,
            service_key TEXT,
            for_child INTEGER DEFAULT 0,
            child_first_name TEXT,
            child_last_name TEXT,
            child_dob TEXT,
            created_at DATETIME,
            expires_at DATETIME
        )
    """)
    print("  Created table: pending_checkouts")
else:
    print("  Already exists: pending_checkouts")

# ── client_profiles table ─────────────────────────────────────────────────────
cur.execute("PRAGMA table_info(client_profiles)")
cp_cols = [row[1] for row in cur.fetchall()]
print("client_profiles columns:", cp_cols)

for col, typedef in [("scores", "TEXT"), ("ai_clinical_report", "TEXT")]:
    if col not in cp_cols:
        cur.execute(f"ALTER TABLE client_profiles ADD COLUMN {col} {typedef}")
        print(f"  Added column: client_profiles.{col}")
    else:
        print(f"  Already exists: client_profiles.{col}")

# ── client_profiles: ethnicity / religion / language ─────────────────────────
cur.execute("PRAGMA table_info(client_profiles)")
cp2_cols = [row[1] for row in cur.fetchall()]
print("client_profiles columns (pass 2):", cp2_cols)

for col, typedef in [("ethnicity", "TEXT"), ("religion_group", "TEXT"), ("preferred_language", "TEXT")]:
    if col not in cp2_cols:
        cur.execute(f"ALTER TABLE client_profiles ADD COLUMN {col} {typedef}")
        print(f"  Added column: client_profiles.{col}")
    else:
        print(f"  Already exists: client_profiles.{col}")

# ── clinician_availability_slots table ───────────────────────────────────────
cur.execute("PRAGMA table_info(clinician_availability_slots)")
slot_cols = [row[1] for row in cur.fetchall()]
print("clinician_availability_slots columns:", slot_cols)

if "booked_client_id" not in slot_cols:
    cur.execute("ALTER TABLE clinician_availability_slots ADD COLUMN booked_client_id TEXT")
    print("  Added column: clinician_availability_slots.booked_client_id")
else:
    print("  Already exists: clinician_availability_slots.booked_client_id")

con.commit()
con.close()
print("Migration complete.")
