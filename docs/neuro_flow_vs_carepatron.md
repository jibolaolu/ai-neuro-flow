# Neuro Flow vs CarePatron

Comparison for positioning **Neuro Flow** as a standalone, multi-tenant clinical SaaS (specialist neurodevelopmental assessment) versus **CarePatron** (general practice management).

| Dimension | Neuro Flow | CarePatron |
|-----------|------------|------------|
| **Primary audience** | ADHD / autism assessment clinics (UK NICE-aligned) | General healthcare & allied health practices globally |
| **Business model** | Clinic subscribes (Starter / Pro / Enterprise); patients not billed by platform | Per-practitioner subscription; practice pays |
| **Multi-tenancy** | Organizations table + `clinic_id` on all tenant data; API enforces row-level isolation | Mature multi-workspace SaaS |
| **Patient payments** | Not via platform (clinic manages billing offline or separately) | Invoicing, payments, superbills common |
| **Referral / intake** | Manual client create, forms by token, optional legacy webhooks (disabled by default) | Online booking, intake forms, CRM-style pipeline |
| **Clinical depth** | DSM-5 / ICD-11 templates, NHS ADHD report schema, senior sign-off queue, AI pre-report | Broad notes, templates, telehealth; less NICE-specific |
| **Scheduling** | Clinician availability, client booking links, session confirmation | Calendar, reminders, recurring appointments |
| **Team roles** | Clinical admin, senior clinician, clinician, platform super-admin | Owner, practitioner, admin, custom roles |
| **Report delivery** | Issued PDF + time-limited public token | Client portal, documents, sharing |
| **Compliance copy** | UK GDPR, consent panels, GP / school / NHS sharing options | HIPAA-oriented (US), general privacy |
| **Integrations** | Stripe Billing (clinic subscription); legacy WooCommerce off by default | Stripe, insurance, many integrations |
| **API** | Demo tier metadata; extensible per org | Established API & marketplace |
| **Branding** | White-label via env (`PLATFORM_DISPLAY_NAME`, etc.) | Practice branding in portal |
| **Best fit** | Specialist neurodevelopmental services needing assessment-to-report workflow | General practice ops: calendar, notes, billing, telehealth |

## Data isolation approach (Neuro Flow)

Neuro Flow uses **shared database, isolated rows**:

1. Every client and clinical report stores `clinic_id` (organization id).
2. Authenticated API handlers filter queries by the user’s `clinic_id`.
3. Cross-tenant access returns **404** (not 403) to avoid leaking existence of records.
4. Platform super-admin can see all tenants (operator role).

For higher assurance at scale, the same model extends to PostgreSQL with optional **Row Level Security (RLS)** policies mirroring application filters.

## Summary

**CarePatron** is a horizontal practice OS (schedule, bill, document, communicate). **Neuro Flow** is a vertical clinical platform for neurodevelopmental assessment with tenant-safe data, clinic-only subscription revenue, and deep assessment/report workflows rather than general billing.
