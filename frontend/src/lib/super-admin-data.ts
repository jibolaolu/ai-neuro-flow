/**
 * Mock platform-level data for the Super Platform Admin control-plane dashboard.
 * In production this would come from the billing DB, Auth0 Management API, and infra telemetry.
 *
 * Subscriber names and details below are placeholder representatives of subscribing clinics.
 * No real clinic name or contact data is embedded — each record uses a generic demo email.
 */

export type SubscriberStatus = "active" | "trial" | "past_due" | "suspended" | "churned";
export type Plan = "enterprise" | "professional" | "starter" | "trial";
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface Subscriber {
  id: string;
  name: string;
  country: string;
  plan: Plan;
  seats: number;
  activeSeats: number;
  mrrGbp: number;
  status: SubscriberStatus;
  health: HealthStatus;
  joinedDate: string;
  lastActiveDate: string;
  industry: string;
  contactEmail: string;
  stripeCustomerId: string;
  auth0OrgId: string;
  pathwaysEnabled: string[];
  nextRenewalDate: string;
  trialEndsDate?: string;
  openSupportTickets: number;
  reportsThisMonth: number;
  storageUsedGb: number;
}

export interface InfraService {
  id: string;
  name: string;
  category: "compute" | "database" | "auth" | "email" | "storage" | "billing";
  status: HealthStatus;
  uptime99d: number;
  avgResponseMs: number;
  p99ResponseMs: number;
  lastCheckedAt: string;
  region: string;
  notes?: string;
}

export interface RevenueMonth {
  month: string;
  mrrGbp: number;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
}

export interface PlatformAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  service?: string;
  subscriberId?: string;
  createdAt: string;
  resolved: boolean;
}

export interface Auth0TenantMetric {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
}

/* ─── Subscriber accounts ─────────────────────────────────────────────────
 * Each entry represents a clinic that has subscribed to the platform.
 * Names are illustrative placeholders — in production these are populated
 * from the database at the point of clinic registration/signup.
 * ──────────────────────────────────────────────────────────────────────── */
export const SUBSCRIBERS: Subscriber[] = [
  {
    id: "org-001",
    name: "[Subscribing Clinic 1]",
    country: "GB",
    plan: "enterprise",
    seats: 20,
    activeSeats: 16,
    mrrGbp: 1200,
    status: "active",
    health: "healthy",
    joinedDate: "2024-03-10",
    lastActiveDate: "2026-05-16",
    industry: "Neurodevelopmental Assessment",
    contactEmail: "admin@clinic-001.example",
    stripeCustomerId: "cus_demo001",
    auth0OrgId: "org_demo001",
    pathwaysEnabled: ["ADHD", "Autism", "Combined"],
    nextRenewalDate: "2027-03-10",
    openSupportTickets: 0,
    reportsThisMonth: 42,
    storageUsedGb: 3.1,
  },
  {
    id: "org-002",
    name: "[Subscribing Clinic 2]",
    country: "GB",
    plan: "professional",
    seats: 10,
    activeSeats: 8,
    mrrGbp: 599,
    status: "active",
    health: "healthy",
    joinedDate: "2024-07-22",
    lastActiveDate: "2026-05-15",
    industry: "Neurodevelopmental Assessment",
    contactEmail: "admin@clinic-002.example",
    stripeCustomerId: "cus_demo002",
    auth0OrgId: "org_demo002",
    pathwaysEnabled: ["ADHD", "Combined"],
    nextRenewalDate: "2026-07-22",
    openSupportTickets: 1,
    reportsThisMonth: 18,
    storageUsedGb: 1.2,
  },
  {
    id: "org-003",
    name: "[Subscribing Clinic 3]",
    country: "GB",
    plan: "professional",
    seats: 8,
    activeSeats: 7,
    mrrGbp: 599,
    status: "active",
    health: "healthy",
    joinedDate: "2025-01-14",
    lastActiveDate: "2026-05-16",
    industry: "Autism & ADHD Assessment",
    contactEmail: "admin@clinic-003.example",
    stripeCustomerId: "cus_demo003",
    auth0OrgId: "org_demo003",
    pathwaysEnabled: ["Autism", "ADHD"],
    nextRenewalDate: "2027-01-14",
    openSupportTickets: 0,
    reportsThisMonth: 14,
    storageUsedGb: 0.9,
  },
  {
    id: "org-004",
    name: "[Subscribing Clinic 4]",
    country: "GB",
    plan: "enterprise",
    seats: 30,
    activeSeats: 24,
    mrrGbp: 1200,
    status: "active",
    health: "degraded",
    joinedDate: "2023-11-05",
    lastActiveDate: "2026-05-16",
    industry: "ADHD Assessment",
    contactEmail: "admin@clinic-004.example",
    stripeCustomerId: "cus_demo004",
    auth0OrgId: "org_demo004",
    pathwaysEnabled: ["ADHD", "Autism", "Combined"],
    nextRenewalDate: "2026-11-05",
    openSupportTickets: 2,
    reportsThisMonth: 67,
    storageUsedGb: 5.8,
  },
  {
    id: "org-005",
    name: "[Subscribing Clinic 5]",
    country: "GB",
    plan: "starter",
    seats: 3,
    activeSeats: 2,
    mrrGbp: 299,
    status: "trial",
    health: "healthy",
    joinedDate: "2026-05-02",
    lastActiveDate: "2026-05-13",
    industry: "Child Psychology",
    contactEmail: "admin@clinic-005.example",
    stripeCustomerId: "cus_demo005",
    auth0OrgId: "org_demo005",
    pathwaysEnabled: ["ADHD"],
    nextRenewalDate: "2026-06-02",
    trialEndsDate: "2026-05-30",
    openSupportTickets: 0,
    reportsThisMonth: 3,
    storageUsedGb: 0.1,
  },
  {
    id: "org-006",
    name: "[Subscribing Clinic 6]",
    country: "GB",
    plan: "professional",
    seats: 10,
    activeSeats: 0,
    mrrGbp: 0,
    status: "past_due",
    health: "unknown",
    joinedDate: "2024-10-11",
    lastActiveDate: "2026-04-30",
    industry: "Autism Assessment",
    contactEmail: "admin@clinic-006.example",
    stripeCustomerId: "cus_demo006",
    auth0OrgId: "org_demo006",
    pathwaysEnabled: ["Autism", "ADHD"],
    nextRenewalDate: "2026-05-11",
    openSupportTickets: 1,
    reportsThisMonth: 0,
    storageUsedGb: 1.4,
  },
  {
    id: "org-007",
    name: "[Subscribing Clinic 7]",
    country: "GB",
    plan: "enterprise",
    seats: 25,
    activeSeats: 22,
    mrrGbp: 1200,
    status: "active",
    health: "healthy",
    joinedDate: "2025-04-08",
    lastActiveDate: "2026-05-16",
    industry: "Neurodevelopmental Assessment",
    contactEmail: "admin@clinic-007.example",
    stripeCustomerId: "cus_demo007",
    auth0OrgId: "org_demo007",
    pathwaysEnabled: ["ADHD", "Autism", "Combined"],
    nextRenewalDate: "2027-04-08",
    openSupportTickets: 0,
    reportsThisMonth: 55,
    storageUsedGb: 4.2,
  },
  {
    id: "org-008",
    name: "[Subscribing Clinic 8]",
    country: "GB",
    plan: "professional",
    seats: 6,
    activeSeats: 5,
    mrrGbp: 599,
    status: "active",
    health: "healthy",
    joinedDate: "2025-08-19",
    lastActiveDate: "2026-05-14",
    industry: "ADHD Assessment",
    contactEmail: "admin@clinic-008.example",
    stripeCustomerId: "cus_demo008",
    auth0OrgId: "org_demo008",
    pathwaysEnabled: ["ADHD", "Combined"],
    nextRenewalDate: "2027-08-19",
    openSupportTickets: 0,
    reportsThisMonth: 11,
    storageUsedGb: 0.6,
  },
  {
    id: "org-009",
    name: "[Subscribing Clinic 9]",
    country: "GB",
    plan: "starter",
    seats: 3,
    activeSeats: 3,
    mrrGbp: 299,
    status: "active",
    health: "healthy",
    joinedDate: "2026-02-28",
    lastActiveDate: "2026-05-12",
    industry: "Developmental Assessment",
    contactEmail: "admin@clinic-009.example",
    stripeCustomerId: "cus_demo009",
    auth0OrgId: "org_demo009",
    pathwaysEnabled: ["Autism"],
    nextRenewalDate: "2027-02-28",
    openSupportTickets: 0,
    reportsThisMonth: 6,
    storageUsedGb: 0.3,
  },
  {
    id: "org-010",
    name: "[Subscribing Clinic 10]",
    country: "GB",
    plan: "professional",
    seats: 8,
    activeSeats: 7,
    mrrGbp: 599,
    status: "active",
    health: "healthy",
    joinedDate: "2025-12-01",
    lastActiveDate: "2026-05-16",
    industry: "ADHD Assessment",
    contactEmail: "admin@clinic-010.example",
    stripeCustomerId: "cus_demo010",
    auth0OrgId: "org_demo010",
    pathwaysEnabled: ["ADHD", "Autism"],
    nextRenewalDate: "2026-12-01",
    openSupportTickets: 1,
    reportsThisMonth: 22,
    storageUsedGb: 0.8,
  },
  {
    id: "org-011",
    name: "[Subscribing Clinic 11]",
    country: "GB",
    plan: "enterprise",
    seats: 40,
    activeSeats: 35,
    mrrGbp: 1200,
    status: "active",
    health: "healthy",
    joinedDate: "2024-05-17",
    lastActiveDate: "2026-05-16",
    industry: "Neurodevelopmental Assessment",
    contactEmail: "admin@clinic-011.example",
    stripeCustomerId: "cus_demo011",
    auth0OrgId: "org_demo011",
    pathwaysEnabled: ["ADHD", "Autism", "Combined"],
    nextRenewalDate: "2027-05-17",
    openSupportTickets: 0,
    reportsThisMonth: 88,
    storageUsedGb: 6.4,
  },
  {
    id: "org-012",
    name: "[Subscribing Clinic 12]",
    country: "GB",
    plan: "professional",
    seats: 8,
    activeSeats: 0,
    mrrGbp: 0,
    status: "churned",
    health: "unknown",
    joinedDate: "2024-02-20",
    lastActiveDate: "2026-04-01",
    industry: "Psychology",
    contactEmail: "admin@clinic-012.example",
    stripeCustomerId: "cus_demo012",
    auth0OrgId: "org_demo012",
    pathwaysEnabled: [],
    nextRenewalDate: "2026-04-20",
    openSupportTickets: 0,
    reportsThisMonth: 0,
    storageUsedGb: 0,
  },
];

/* ─── Infrastructure services ─────────────────────────────────────── */
export const INFRA_SERVICES: InfraService[] = [
  { id: "svc-api",      name: "FastAPI Backend",       category: "compute",  status: "healthy",  uptime99d: 99.94, avgResponseMs: 58,   p99ResponseMs: 210,  lastCheckedAt: "2026-05-17T09:58:00Z", region: "local / eu-west-2" },
  { id: "svc-web",      name: "Next.js Web App",       category: "compute",  status: "healthy",  uptime99d: 99.98, avgResponseMs: 120,  p99ResponseMs: 380,  lastCheckedAt: "2026-05-17T09:58:00Z", region: "local / eu-west-2" },
  { id: "svc-db",       name: "SQLite / PostgreSQL",   category: "database", status: "healthy",  uptime99d: 99.99, avgResponseMs: 5,    p99ResponseMs: 22,   lastCheckedAt: "2026-05-17T09:58:00Z", region: "local" },
  { id: "svc-auth0",    name: "Auth0 Identity",        category: "auth",     status: "healthy",  uptime99d: 99.99, avgResponseMs: 90,   p99ResponseMs: 240,  lastCheckedAt: "2026-05-17T09:58:00Z", region: "eu" },
  { id: "svc-sendgrid", name: "SendGrid Email",        category: "email",    status: "healthy",  uptime99d: 99.90, avgResponseMs: 320,  p99ResponseMs: 900,  lastCheckedAt: "2026-05-17T09:55:00Z", region: "global" },
  { id: "svc-stripe",   name: "Stripe Billing",        category: "billing",  status: "healthy",  uptime99d: 99.99, avgResponseMs: 130,  p99ResponseMs: 500,  lastCheckedAt: "2026-05-17T09:58:00Z", region: "global" },
  { id: "svc-nginx",    name: "nginx Reverse Proxy",   category: "compute",  status: "healthy",  uptime99d: 100,   avgResponseMs: 2,    p99ResponseMs: 10,   lastCheckedAt: "2026-05-17T09:58:00Z", region: "local" },
  { id: "svc-pdf",      name: "PDF Report Engine",     category: "compute",  status: "healthy",  uptime99d: 99.85, avgResponseMs: 1200, p99ResponseMs: 4800, lastCheckedAt: "2026-05-17T09:56:00Z", region: "local" },
];

/* ─── Revenue trend ───────────────────────────────────────────────── */
export const REVENUE_MONTHS: RevenueMonth[] = [
  { month: "2025-11", mrrGbp: 2396, newMrr: 598,  churnedMrr: 0,   expansionMrr: 0 },
  { month: "2025-12", mrrGbp: 3293, newMrr: 1197, churnedMrr: 300, expansionMrr: 0 },
  { month: "2026-01", mrrGbp: 3892, newMrr: 899,  churnedMrr: 300, expansionMrr: 0 },
  { month: "2026-02", mrrGbp: 4790, newMrr: 1198, churnedMrr: 300, expansionMrr: 0 },
  { month: "2026-03", mrrGbp: 5389, newMrr: 899,  churnedMrr: 300, expansionMrr: 0 },
  { month: "2026-04", mrrGbp: 5988, newMrr: 899,  churnedMrr: 300, expansionMrr: 0 },
  { month: "2026-05", mrrGbp: 6289, newMrr: 598,  churnedMrr: 299, expansionMrr: 0 },
];

/* ─── Platform alerts ─────────────────────────────────────────────── */
export const PLATFORM_ALERTS: PlatformAlert[] = [
  {
    id: "alert-001",
    severity: "warning",
    title: "Clinic 4 — slow report generation",
    detail: "PDF render p99 latency 6.2 s (threshold 5 s). High volume month — 67 reports queued.",
    service: "svc-pdf",
    subscriberId: "org-004",
    createdAt: "2026-05-17T08:22:00Z",
    resolved: false,
  },
  {
    id: "alert-002",
    severity: "warning",
    title: "Clinic 6 — payment past due",
    detail: "Invoice INV-2026-052 overdue by 17 days. Subscription access suspended automatically.",
    subscriberId: "org-006",
    createdAt: "2026-05-17T07:00:00Z",
    resolved: false,
  },
  {
    id: "alert-003",
    severity: "info",
    title: "Clinic 5 — trial ends in 13 days",
    detail: "Trial period expires 2026-05-30. No payment method on file. Trigger conversion sequence.",
    subscriberId: "org-005",
    createdAt: "2026-05-17T06:00:00Z",
    resolved: false,
  },
  {
    id: "alert-004",
    severity: "info",
    title: "Clinic 12 — data retention notice",
    detail: "Churned 2026-04-01. Data retention window (60 days) expires 2026-05-31. Schedule deletion.",
    subscriberId: "org-012",
    createdAt: "2026-05-16T14:00:00Z",
    resolved: false,
  },
  {
    id: "alert-005",
    severity: "critical",
    title: "Auth0 token refresh spike",
    detail: "Abnormal refresh rate 09:00–09:15 UTC — 4× normal volume. No failed logins. Investigating.",
    service: "svc-auth0",
    createdAt: "2026-05-15T09:18:00Z",
    resolved: true,
  },
];

/* ─── Auth0 tenant metrics ────────────────────────────────────────── */
export const AUTH0_METRICS: Auth0TenantMetric[] = [
  { label: "Total users",            value: 312,     trend: "up",   trendLabel: "+8 this week" },
  { label: "Active sessions (24h)",  value: 74,      trend: "flat" },
  { label: "Logins today",           value: 118,     trend: "up",   trendLabel: "vs 94 yesterday" },
  { label: "Login success rate",     value: "99.4%", trend: "flat" },
  { label: "MFA enrolment",          value: "68%",   trend: "up",   trendLabel: "+5% MoM" },
  { label: "Password resets (30d)",  value: 6,       trend: "down", trendLabel: "vs 11 prior 30d" },
  { label: "Failed logins (24h)",    value: 3,       trend: "flat" },
  { label: "Orgs / tenants",         value: 12,      trend: "up",   trendLabel: "+1 this month" },
];

/* ─── Computed platform KPIs ──────────────────────────────────────── */
export const platformKpis = {
  totalOrgs:             SUBSCRIBERS.length,
  activeOrgs:            SUBSCRIBERS.filter((s) => s.status === "active").length,
  trialOrgs:             SUBSCRIBERS.filter((s) => s.status === "trial").length,
  pastDueOrgs:           SUBSCRIBERS.filter((s) => s.status === "past_due").length,
  churnedOrgs:           SUBSCRIBERS.filter((s) => s.status === "churned").length,
  totalMrrGbp:           SUBSCRIBERS.filter((s) => s.status === "active").reduce((acc, o) => acc + o.mrrGbp, 0),
  totalSeats:            SUBSCRIBERS.filter((s) => s.status === "active").reduce((acc, o) => acc + o.seats, 0),
  totalActiveSeats:      SUBSCRIBERS.filter((s) => s.status === "active").reduce((acc, o) => acc + o.activeSeats, 0),
  systemUptime:          "99.97",
  openAlerts:            PLATFORM_ALERTS.filter((a) => !a.resolved).length,
  criticalAlerts:        PLATFORM_ALERTS.filter((a) => !a.resolved && a.severity === "critical").length,
  totalReportsThisMonth: SUBSCRIBERS.reduce((acc, o) => acc + o.reportsThisMonth, 0),
  openSupportTickets:    SUBSCRIBERS.reduce((acc, o) => acc + o.openSupportTickets, 0),
};
