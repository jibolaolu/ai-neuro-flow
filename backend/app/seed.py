"""
Seed Neuro Flow for local testing: organizations, users, demo clients.

    cd adhd-autism-platform/backend
    python -m app.seed

Credentials are printed to stdout after seeding.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.sqlite_migrate import ensure_sqlite_columns
from app.db.session import SessionLocal, engine
from app.db.tenant_migrate import DEFAULT_ORG_ID, ensure_default_organization
from app.models.client import ClientRecord
from app.models.organization import SUB_ACTIVE, SUB_TRIALING, OrganizationRecord
from app.models.user import UserRecord

DEMO_ORG_ID = DEFAULT_ORG_ID
DEMO_ORG_B_ID = "ORG-DEMO-BETA"

# Per-plan clinic IDs — must match setup-auth0.js SEED_CLINICS.clinicId values
CLINIC_STARTER_ID = "CLINIC-STARTER"
CLINIC_PRO_ID     = "CLINIC-PRO"
CLINIC_ENT_ID     = "CLINIC-ENT"

# Stable ids so re-seed is idempotent for clients
DEMO_CLIENTS = [
    {
        "id": "CLI-DEMO-ADULT01",
        "full_name": "Jordan Ellis",
        "email": "jordan.ellis@example.test",
        "pathway": "Adult ADHD",
        "age_group": "Adult",
        "status": "Forms Sent",
        "stage": "Intake",
        "source": "manual",
        "assign_email": "clinician@neuroflow.test",
    },
    {
        "id": "CLI-DEMO-CHILD01",
        "full_name": "Parent: Sam Taylor (child Leo)",
        "email": "sam.taylor@example.test",
        "pathway": "Child Autism",
        "age_group": "Child",
        "child_name": "Leo Taylor",
        "child_dob": "2016-03-15",
        "status": "Forms Returned, Ready to Schedule",
        "stage": "Scheduling",
        "source": "manual",
        "assign_email": "seniorclinician@neuroflow.test",
    },
    {
        "id": "CLI-DEMO-ADULT02",
        "full_name": "Priya Nair",
        "email": "priya.nair@example.test",
        "pathway": "Adult Autism",
        "age_group": "Adult",
        "status": "New",
        "stage": "Intake",
        "source": "manual",
        "assign_email": None,
    },
]

TEST_USERS = [
    {
        "id": "USR-PLATFORM-ADMIN",
        "email": "platform@neuroflow.test",
        "full_name": "Neuro Flow Platform Admin",
        "password": "PeopleOSTest01!",
        "role": "super-platform-admin",
        "clinic_id": None,
    },
    {
        "id": "USR-SUPER-ADMIN",
        "email": "superadmin@neuroflow.test",
        "full_name": "Alex Thornton",
        "password": "SuperAdmin@2024!",
        "role": "super-platform-admin",
        "clinic_id": None,
    },
    {
        "id": "USR-CLINIC-ADMIN",
        "email": "clinicaladmin@neuroflow.test",
        "full_name": "Sarah Mitchell",
        "password": "ClinicalAdmin@2024!",
        "role": "clinical-admin",
        "clinic_id": DEMO_ORG_ID,
    },
    {
        "id": "USR-SENIOR-CLIN",
        "email": "seniorclinician@neuroflow.test",
        "full_name": "Dr James Okafor",
        "password": "SeniorClin@2024!",
        "role": "senior-clinician",
        "clinic_id": DEMO_ORG_ID,
    },
    {
        "id": "USR-CLINICIAN",
        "email": "clinician@neuroflow.test",
        "full_name": "Dr Maya Patel",
        "password": "Clinician@2024!",
        "role": "clinician",
        "clinic_id": DEMO_ORG_ID,
    },
    {
        "id": "USR-BETA-ADMIN",
        "email": "admin@betaclinic.neuroflow.test",
        "full_name": "Beta Clinic Admin",
        "password": "BetaAdmin@2024!",
        "role": "clinical-admin",
        "clinic_id": DEMO_ORG_B_ID,
    },
    # ── Per-plan accounts (match setup-auth0.js PLAN_TEST_USERS) ──────────
    # Starter plan clinic
    {
        "id": "USR-STARTER-ADMIN",
        "email": "starter.admin@neuroflow.test",
        "full_name": "Starter Test Clinic Clinical Admin",
        "password": "NeuroFlowTest01!",
        "role": "clinical-admin",
        "clinic_id": CLINIC_STARTER_ID,
    },
    {
        "id": "USR-STARTER-SENIOR",
        "email": "starter.senior@neuroflow.test",
        "full_name": "Starter Test Clinic Senior Clinician",
        "password": "NeuroFlowTest01!",
        "role": "senior-clinician",
        "clinic_id": CLINIC_STARTER_ID,
    },
    {
        "id": "USR-STARTER-CLIN",
        "email": "starter.clinician@neuroflow.test",
        "full_name": "Starter Test Clinic Clinician",
        "password": "NeuroFlowTest01!",
        "role": "clinician",
        "clinic_id": CLINIC_STARTER_ID,
    },
    # Professional plan clinic
    {
        "id": "USR-PRO-ADMIN",
        "email": "professional.admin@neuroflow.test",
        "full_name": "Professional Test Clinic Clinical Admin",
        "password": "NeuroFlowTest01!",
        "role": "clinical-admin",
        "clinic_id": CLINIC_PRO_ID,
    },
    {
        "id": "USR-PRO-SENIOR",
        "email": "professional.senior@neuroflow.test",
        "full_name": "Professional Test Clinic Senior Clinician",
        "password": "NeuroFlowTest01!",
        "role": "senior-clinician",
        "clinic_id": CLINIC_PRO_ID,
    },
    {
        "id": "USR-PRO-CLIN",
        "email": "professional.clinician@neuroflow.test",
        "full_name": "Professional Test Clinic Clinician",
        "password": "NeuroFlowTest01!",
        "role": "clinician",
        "clinic_id": CLINIC_PRO_ID,
    },
    # Enterprise plan clinic
    {
        "id": "USR-ENT-ADMIN",
        "email": "enterprise.admin@neuroflow.test",
        "full_name": "Enterprise Test Clinic Clinical Admin",
        "password": "NeuroFlowTest01!",
        "role": "clinical-admin",
        "clinic_id": CLINIC_ENT_ID,
    },
    {
        "id": "USR-ENT-SENIOR",
        "email": "enterprise.senior@neuroflow.test",
        "full_name": "Enterprise Test Clinic Senior Clinician",
        "password": "NeuroFlowTest01!",
        "role": "senior-clinician",
        "clinic_id": CLINIC_ENT_ID,
    },
    {
        "id": "USR-ENT-CLIN",
        "email": "enterprise.clinician@neuroflow.test",
        "full_name": "Enterprise Test Clinic Clinician",
        "password": "NeuroFlowTest01!",
        "role": "clinician",
        "clinic_id": CLINIC_ENT_ID,
    },
]


def _ensure_org(db, org_id: str, name: str, slug: str, status: str = SUB_TRIALING) -> None:
    if db.query(OrganizationRecord).filter(OrganizationRecord.id == org_id).first():
        return
    trial_end = datetime.now(timezone.utc) + timedelta(days=settings.signup_trial_days)
    db.add(
        OrganizationRecord(
            id=org_id,
            name=name,
            slug=slug,
            subscription_status=status,
            trial_ends_at=trial_end if status == SUB_TRIALING else None,
        )
    )


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_columns(engine)
    ensure_default_organization(engine)
    db = SessionLocal()

    _ensure_org(db, DEMO_ORG_ID,       "Neuro Flow Demo Clinic",      "demo-clinic")
    _ensure_org(db, DEMO_ORG_B_ID,     "Beta Assessment Clinic",      "beta-clinic")
    # Per-plan test clinics — IDs must match setup-auth0.js SEED_CLINICS
    _ensure_org(db, CLINIC_STARTER_ID, "Starter Test Clinic",         "starter-test",      status=SUB_TRIALING)
    _ensure_org(db, CLINIC_PRO_ID,     "Professional Test Clinic",    "professional-test", status=SUB_ACTIVE)
    _ensure_org(db, CLINIC_ENT_ID,     "Enterprise Test Clinic",      "enterprise-test",   status=SUB_ACTIVE)
    db.commit()

    users_seeded = []
    users_skipped = []

    for data in TEST_USERS:
        existing = db.query(UserRecord).filter(UserRecord.email == data["email"]).first()
        if existing:
            users_skipped.append(data["email"])
            continue
        db.add(
            UserRecord(
                id=data["id"],
                email=data["email"],
                full_name=data["full_name"],
                hashed_password=hash_password(data["password"]),
                role=data["role"],
                is_active=True,
                clinic_id=data["clinic_id"],
            )
        )
        users_seeded.append(data)

    db.commit()

    email_to_id = {
        u.email: u.id for u in db.query(UserRecord).filter(UserRecord.email.isnot(None)).all()
    }

    clients_seeded = []
    clients_skipped = []

    for c in DEMO_CLIENTS:
        if db.query(ClientRecord).filter(ClientRecord.id == c["id"]).first():
            clients_skipped.append(c["id"])
            continue
        assign_id = None
        if c.get("assign_email"):
            assign_id = email_to_id.get(c["assign_email"])
        assessment_id = f"ASS-{uuid.uuid4().hex[:8].upper()}"
        db.add(
            ClientRecord(
                id=c["id"],
                clinic_id=DEMO_ORG_ID,
                full_name=c["full_name"],
                email=c["email"],
                pathway=c["pathway"],
                age_group=c.get("age_group"),
                child_name=c.get("child_name"),
                child_dob=c.get("child_dob"),
                status=c["status"],
                stage=c["stage"],
                source=c["source"],
                assessment_id=assessment_id,
                assigned_clinician_user_id=assign_id,
            )
        )
        clients_seeded.append(c["id"])

    db.commit()
    db.close()

    seeded_emails = {u["email"] for u in users_seeded}

    print("\n" + "=" * 68)
    print("  Neuro Flow — seed complete")
    print("=" * 68)

    print("\nOrganizations:")
    print(f"  {DEMO_ORG_ID:<20}  Neuro Flow Demo Clinic        (trialing)")
    print(f"  {DEMO_ORG_B_ID:<20}  Beta Assessment Clinic        (trialing)")
    print(f"  {CLINIC_STARTER_ID:<20}  Starter Test Clinic           (trialing)")
    print(f"  {CLINIC_PRO_ID:<20}  Professional Test Clinic      (active)")
    print(f"  {CLINIC_ENT_ID:<20}  Enterprise Test Clinic        (active)")

    print("\nCore / named users  (password varies — see below):")
    core_users = [u for u in TEST_USERS if not u["email"].split("@")[0].replace(".", "").replace("-", "").isalpha() or
                  u["email"] in ("platform@neuroflow.test", "superadmin@neuroflow.test",
                                 "clinicaladmin@neuroflow.test", "seniorclinician@neuroflow.test",
                                 "clinician@neuroflow.test", "admin@betaclinic.neuroflow.test")]
    for u in TEST_USERS:
        if u["email"] not in [pu["email"] for pu in TEST_USERS if pu["email"].split(".")[0] in ("starter", "professional", "enterprise")]:
            mark = "new" if u["email"] in seeded_emails else "exists"
            print(f"  [{u['role']:22s}]  {u['email']:40s}  {u['password']}  ({mark})")

    print(f"\nPer-plan accounts  (password: NeuroFlowTest01!):")
    plan_emails = [u["email"] for u in TEST_USERS if u["email"].split(".")[0] in ("starter", "professional", "enterprise")]
    for u in TEST_USERS:
        if u["email"] in plan_emails:
            mark = "new" if u["email"] in seeded_emails else "exists"
            print(f"  [{u['role']:22s}]  {u['email']:44s}  ({mark})")

    print("\nDemo clients (clinic CLINIC-001):")
    for cid in DEMO_CLIENTS:
        mark = "new" if cid["id"] in clients_seeded else "exists"
        print(f"  {cid['id']:20s}  {cid['full_name'][:30]:30s}  ({mark})")

    print("\nNotes:")
    print("  • starter.*/professional.*/enterprise.* accounts require Auth0.")
    print("    Run:  node scripts/setup-auth0.js   (creates matching Auth0 users)")
    print("  • admin@betaclinic.neuroflow.test only sees ORG-DEMO-BETA data.")
    print("=" * 68 + "\n")


if __name__ == "__main__":
    seed()
