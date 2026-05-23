import Link from "next/link";

import { getBackendHealth } from "../lib/api";
import { BRAND } from "../lib/branding";
import { getMockAuthHref, mockRoleLabels, type MockRoleKey } from "../lib/mock-auth";
import { PricingSection } from "./pricing";

const PLATFORM_SIGNALS = [
  { label: "Pathways", value: "ADHD", detail: "Autism · Combined" },
  { label: "Tenancy", value: "Row-level", detail: "per clinic" },
  { label: "Reports", value: "NICE", detail: "aligned templates" },
  { label: "Identity", value: "Auth0", detail: "production-ready" },
];

const PRODUCT_PILLARS = [
  {
    title: "Clinic operations",
    copy: "Intake queues, clinician allocation, booking, and finance in one admin workspace.",
  },
  {
    title: "Clinical delivery",
    copy: "Assigned caseloads, structured assessment templates, and session documentation.",
  },
  {
    title: "Senior sign-off",
    copy: "Report review queues, diagnostic approval, and secure client release.",
  },
  {
    title: "Platform oversight",
    copy: "Cross-tenant health, subscriptions, and operator controls for SaaS admins.",
  },
];

type PortalDef = {
  mockRole: MockRoleKey;
  path: string;
  title: string;
  kicker: string;
  description: string;
  metrics: { label: string; value: string }[];
};

const WORKSPACE_PORTALS: PortalDef[] = [
  {
    mockRole: "super-admin",
    path: "/super-admin",
    kicker: "Platform",
    title: "Super platform admin",
    description:
      "Cross-clinic subscriptions, tenant health, and operator tooling. Mirrors PeopleOS platform@peopleos.test.",
    metrics: [
      { label: "Tenants", value: "12" },
      { label: "Trials", value: "3" },
    ],
  },
  {
    mockRole: "clinic-admin",
    path: "/clinic-admin",
    kicker: "Clinic",
    title: "Clinical admin",
    description: "Intake, scheduling, team invites, finance queue, and report release for your practice.",
    metrics: [
      { label: "Queue", value: "8" },
      { label: "Booked", value: "24" },
    ],
  },
  {
    mockRole: "senior-clinician",
    path: "/senior-clinician",
    kicker: "Clinical",
    title: "Senior clinician",
    description: "Sign-off authority, report review, and oversight of junior clinicians.",
    metrics: [
      { label: "Review", value: "5" },
      { label: "Due", value: "2" },
    ],
  },
  {
    mockRole: "clinician",
    path: "/clinician",
    kicker: "Clinical",
    title: "Clinician",
    description: "Assigned clients, assessments hub, availability, and timesheets.",
    metrics: [
      { label: "Caseload", value: "14" },
      { label: "Reports", value: "3" },
    ],
  },
];

const JOURNEY_STEPS = [
  ["Register your clinic", "Sign up, invite clinicians, start your trial."],
  ["Intake & allocation", "Client records, forms, and clinician assignment."],
  ["Assessment delivery", "Sessions and structured clinical documentation."],
  ["Senior review", "Diagnostic reports approved before release."],
  ["Secure delivery", "Time-limited links for clients to receive reports."],
] as const;

export async function MarketingHome() {
  const health = await getBackendHealth();
  const systemHealthy = health.status === "ok";
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="nfLanding">
      <nav className="nfLandingNav" aria-label="Primary">
        <Link className="nfLogo" href="/">
          <span className="nfLogoMark">NF</span>
          <span>{BRAND.name}</span>
        </Link>
        <div className="nfNavLinks">
          <a href="#platform">Platform</a>
          <a href="#workspaces">Workspaces</a>
          <a href="#journey">Journey</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nfNavActions">
          <Link className="primary-action" href="/login">
            Sign in
          </Link>
        </div>
      </nav>

      <section className="nfHero">
        <div className="nfHeroScene" aria-hidden>
          <div className="nfHeroBoard">
            <div className="nfHeroPanel nfHeroPanelWide">
              <small>Clinic command</small>
              <strong>Intake · scheduling · reports</strong>
              <div className="nfHeroChart">
                <i style={{ height: "48%" }} />
                <i style={{ height: "72%" }} />
                <i style={{ height: "58%" }} />
                <i style={{ height: "88%" }} />
                <i style={{ height: "64%" }} />
              </div>
            </div>
            <div className="nfHeroPanel">
              <small>Forms returned</small>
              <strong>6</strong>
              <span>ready to schedule</span>
            </div>
            <div className="nfHeroPanel nfHeroPanelDark">
              <small>Reports pending</small>
              <strong>4</strong>
              <span>senior review</span>
            </div>
            <div className="nfHeroPanel">
              <small>Active clinicians</small>
              <strong>9</strong>
              <span>this week</span>
            </div>
          </div>
        </div>
        <HeroCopy systemHealthy={systemHealthy} />
      </section>

      <section className="nfSignalStrip" aria-label="Platform signals">
        {PLATFORM_SIGNALS.map((s) => (
          <div key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>{s.detail}</small>
          </div>
        ))}
      </section>

      <section className="nfSection" id="platform">
        <SectionIntro
          eyebrow="Platform"
          title="Built for neurodevelopmental clinics"
          lead="Multi-tenant SaaS with strict isolation per organization. Your practice subscribes once; clinicians and admins work in role-specific dashboards."
        />
        <div className="nfFeatureGrid">
          {PRODUCT_PILLARS.map((p) => (
            <article key={p.title} className="nfFeatureCard">
              <span className="nfFeatureIcon" aria-hidden>
                ✓
              </span>
              <h3>{p.title}</h3>
              <p>{p.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nfSection nfSectionDark" id="workspaces">
        <SectionIntro
          eyebrow="Workspaces"
          title="Dashboards for every role"
          lead="Each role opens a dedicated operational console — the same pattern as PeopleOS, tailored for ADHD and autism assessment workflows."
          dark
        />
        <PortalGrid portals={WORKSPACE_PORTALS} isDev={isDev} />
      </section>

      <section className="nfSection" id="journey">
        <SectionIntro
          eyebrow="Journey"
          title="From referral to signed report"
          lead="Five stages your clinic runs inside Neuro Flow."
        />
        <div className="nfJourneyGrid">
          {JOURNEY_STEPS.map(([title, copy], i) => (
            <article key={title} className="nfJourneyCard">
              <span className="nfJourneyStep">Step {i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <PricingSection />

      <section className="nfFinalCta">
        <h2>Ready to run your clinic on {BRAND.name}?</h2>
        <p>Start a trial, invite your team, and connect Auth0 for production sign-in.</p>
        <div className="nfFinalCtaActions">
          <Link className="primary-action" href="/signup">
            Start free trial
          </Link>
          <Link className="secondary-action" href="/pricing">
            View pricing
          </Link>
          <Link className="ghost-chip" href="/login">
            Sign in
          </Link>
        </div>
      </section>

      <footer className="nfFooter">
        <p>
          {BRAND.name} — {BRAND.tagline}. NICE-aligned · GDPR-aware · Clinic-managed intake.
        </p>
        {isDev && (
          <p className="nfFooterDev">
            Local: http://localhost:3004 · HTTPS (nginx): https://neuroflow.localtest.me:8443 —
            run <code>setup_local_https_proxy.sh --force</code> in Documents/localproxy if the
            site does not load.
          </p>
        )}
      </footer>
    </main>
  );
}

function HeroCopy({ systemHealthy }: { systemHealthy: boolean }) {
  return (
    <div className="nfHeroOverlay">
      <span className="nfBadge">Clinical SaaS · Multi-tenant</span>
      <h1>Neurodevelopmental assessment, orchestrated end to end</h1>
      <p>
        {BRAND.name} connects clinic administration, clinician delivery, and senior sign-off in
        secure, NICE-aligned workspaces — with platform oversight for operators.
      </p>
      <div className="nfHeroActions">
        <Link className="primary-action" href="/signup">
          Start free trial
        </Link>
        <Link className="secondary-action" href="/login">
          Sign in
        </Link>
      </div>
      <div className="nfTrustLine">
        <span className={systemHealthy ? "status-good" : "status-risk"}>
          API {systemHealthy ? "healthy" : "checking…"}
        </span>
        <span>Auth0 ready</span>
        <span>Tenant isolated</span>
        <span>UK clinics</span>
      </div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  lead,
  dark,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  dark?: boolean;
}) {
  return (
    <div className={dark ? "nfSectionIntro nfSectionIntroDark" : "nfSectionIntro"}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{lead}</p>
    </div>
  );
}

function PortalGrid({ portals, isDev }: { portals: PortalDef[]; isDev: boolean }) {
  return (
    <div className="nfPortalGrid">
      {portals.map((portal) => (
        <article key={portal.mockRole} className="nfPortalCard">
          <span className="nfPortalKicker">{portal.kicker}</span>
          <h3>{portal.title}</h3>
          <p>{portal.description}</p>
          <div className="nfPortalMetrics">
            {portal.metrics.map((m) => (
              <div key={m.label}>
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>
          <div className="nfPortalActions">
            <Link className="primary-action" href={portal.path}>
              Open workspace
            </Link>
            <Link className="ghost-chip" href="/login">
              Sign in
            </Link>
            {isDev && (
              <Link className="ghost-chip" href={getMockAuthHref(portal.mockRole, portal.path)}>
                Dev: {mockRoleLabels[portal.mockRole]}
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
