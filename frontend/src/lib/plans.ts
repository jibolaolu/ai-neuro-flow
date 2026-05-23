/**
 * Single source of truth for Neuro Flow subscription plans.
 *
 * All pricing pages, marketing components, and the signup flow import from here.
 * If prices change, update ONLY this file.
 *
 * Feature tiers are additive — Professional includes everything in Starter,
 * Enterprise includes everything in Professional.
 */

export type PlanTier = "starter" | "professional" | "enterprise";

export type PlanFeature = {
  text: string;
  /** true = highlighted as a key differentiator for this plan */
  highlight?: boolean;
};

export type PlanDefinition = {
  id: PlanTier;
  name: string;
  price: string;
  period?: string;
  billing?: string;
  description: string;
  /** Short one-liner used in compact contexts (pricing page hero, API fallback) */
  tagline: string;
  seats: string;
  featured: boolean;
  ctaLabel: string;
  ctaHref: string;
  features: PlanFeature[];
};

export const PLANS: PlanDefinition[] = [
  /* ─────────────────────────────────────────────
   * STARTER — small independent clinics
   * ───────────────────────────────────────────── */
  {
    id: "starter",
    name: "Starter",
    price: "£299",
    period: "/month",
    billing: "Billed monthly · excl. VAT",
    description: "For small independent clinics beginning their digital assessment journey.",
    tagline: "Up to 3 clinicians · core workflows",
    seats: "Up to 3 clinicians",
    featured: false,
    ctaLabel: "Start free trial",
    ctaHref: "/signup?plan=starter",
    features: [
      { text: "Up to 3 clinician seats" },
      { text: "Client intake & referral management" },
      { text: "NICE-aligned ADHD & autism assessment templates" },
      { text: "Secure client record storage (GDPR-compliant)" },
      { text: "Basic PDF diagnostic report generation" },
      { text: "Role-based access (admin + clinician)" },
      { text: "14-day free trial" },
      { text: "Email support (48 h response)" },
    ],
  },

  /* ─────────────────────────────────────────────
   * PROFESSIONAL — growing practices
   * ───────────────────────────────────────────── */
  {
    id: "professional",
    name: "Professional",
    price: "£599",
    period: "/month",
    billing: "Billed monthly · excl. VAT",
    description: "The complete toolkit for growing neurodevelopmental practices.",
    tagline: "Up to 10 clinicians · advanced workflows",
    seats: "Up to 10 clinicians",
    featured: true,
    ctaLabel: "Start free trial",
    ctaHref: "/signup?plan=professional",
    features: [
      { text: "Everything in Starter", highlight: true },
      { text: "Up to 10 clinician seats", highlight: true },
      { text: "Senior clinician sign-off & report approval", highlight: true },
      { text: "Clinician allocation & caseload management", highlight: true },
      { text: "Booking & scheduling workflows", highlight: true },
      { text: "Finance queue & invoicing tools", highlight: true },
      { text: "Full audit trail (NICE / CQC ready)" },
      { text: "14-day free trial" },
      { text: "Priority support (next business day)" },
    ],
  },

  /* ─────────────────────────────────────────────
   * ENTERPRISE — multi-site networks
   * ───────────────────────────────────────────── */
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Bespoke solutions for multi-site clinic networks and operators.",
    tagline: "Unlimited clinicians · API access · dedicated support",
    seats: "Unlimited clinicians & sites",
    featured: false,
    ctaLabel: "Contact sales",
    ctaHref: "/contact",
    features: [
      { text: "Everything in Professional", highlight: true },
      { text: "Unlimited clinician seats & sites", highlight: true },
      { text: "Multi-site / multi-org management", highlight: true },
      { text: "Custom Auth0 SSO integration", highlight: true },
      { text: "REST API access & webhook delivery", highlight: true },
      { text: "CQC-aligned audit trails & exports" },
      { text: "Dedicated account manager" },
      { text: "Custom onboarding & staff training" },
      { text: "SLA & uptime guarantees" },
    ],
  },
];

/** Lookup a plan by id — throws if not found */
export function getPlan(id: PlanTier): PlanDefinition {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

/** Plain feature strings for a plan (used where PlanFeature objects aren't needed) */
export function planFeatureStrings(id: PlanTier): string[] {
  return getPlan(id).features.map((f) => f.text);
}
