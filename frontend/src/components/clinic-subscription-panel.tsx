"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BRAND } from "../lib/branding";
import type { Organization } from "../lib/organizations-api";
import { fetchMyOrganization } from "../lib/organizations-api";
import {
  createCheckout,
  fetchPlans,
  openBillingPortal,
  type Plan,
} from "../lib/subscriptions-api";

function statusLabel(status: string): { text: string; tone: "good" | "warn" | "risk" } {
  switch (status) {
    case "active":
      return { text: "Active subscription", tone: "good" };
    case "trialing":
      return { text: "Free trial", tone: "good" };
    case "past_due":
      return { text: "Payment past due", tone: "warn" };
    case "canceled":
      return { text: "Canceled", tone: "risk" };
    default:
      return { text: status, tone: "warn" };
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

async function getSessionToken(): Promise<string> {
  const me = await fetch("/api/auth/token", { cache: "no-store" });
  if (!me.ok) throw new Error("Not signed in");
  const { token } = (await me.json()) as { token: string };
  return token;
}

export function ClinicSubscriptionPanel({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams();
  const [org, setOrg] = useState<Organization | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const plansRes = await fetchPlans();
      setPlans(plansRes.plans);
      setStripeEnabled(plansRes.stripe_enabled);
      setTrialDays(plansRes.trial_days);
      const token = await getSessionToken();
      setOrg(await fetchMyOrganization(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subscription");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      setSuccessMsg("Subscription activated. Thank you!");
    }
  }, [searchParams]);

  async function onSubscribe(planId: string) {
    setBusyPlan(planId);
    setError(null);
    try {
      const token = await getSessionToken();
      const { checkout_url } = await createCheckout(token, planId);
      if (checkout_url) window.location.href = checkout_url;
      else throw new Error("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusyPlan(null);
    }
  }

  async function onManageBilling() {
    setError(null);
    try {
      const token = await getSessionToken();
      const { portal_url } = await openBillingPortal(token);
      if (portal_url) window.location.href = portal_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing portal unavailable");
    }
  }

  if (loading) {
    return (
      <article className={compact ? "mini-card" : "workspace-card"}>
        <p className="page-lead">Loading subscription…</p>
      </article>
    );
  }

  const st = org ? statusLabel(org.subscription_status) : null;
  const trialLeft = org?.subscription_status === "trialing" ? daysUntil(org.trial_ends_at) : null;
  const showSubscribe = org && org.subscription_status !== "active" && stripeEnabled;

  return (
    <article className={compact ? "mini-card subscription-banner" : "workspace-card"}>
      {!compact && (
        <div className="workspace-card-header" style={{ marginBottom: "1rem" }}>
          <div>
            <span className="panel-label">Clinic subscription</span>
            <h2>{BRAND.name} plan</h2>
            <p className="page-lead" style={{ marginTop: "0.35rem" }}>
              Your clinic pays for {BRAND.name}. Patients are never billed by the platform.
            </p>
          </div>
        </div>
      )}

      {successMsg && <p className="form-success" style={{ color: "var(--status-good)" }}>{successMsg}</p>}
      {error && <p className="form-error">{error}</p>}

      {org && st && !compact && (
        <div className="metrics-row" style={{ marginBottom: "1.25rem" }}>
          <article className="snapshot-card">
            <span>Status</span>
            <strong className={`status-${st.tone}`}>{st.text}</strong>
          </article>
          {org.subscription_plan && (
            <article className="snapshot-card">
              <span>Plan</span>
              <strong style={{ textTransform: "capitalize" }}>{org.subscription_plan}</strong>
            </article>
          )}
          {trialLeft !== null && (
            <article className="snapshot-card">
              <span>Trial remaining</span>
              <strong>{trialLeft > 0 ? `${trialLeft} days` : "Expired"}</strong>
            </article>
          )}
        </div>
      )}

      {compact && org && st && (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
          <strong>{org.name}</strong> — {st.text}
          {trialLeft !== null && trialLeft > 0 ? ` · ${trialLeft} days left` : ""}
          {org.subscription_status !== "active"
            ? ". Subscribe to keep full access after your trial."
            : "."}
        </p>
      )}

      {!stripeEnabled && (
        <p className="page-lead" style={{ fontSize: compact ? "0.85rem" : undefined }}>
          Stripe is not configured. Your clinic has a {trialDays}-day trial on {BRAND.name}. Add{" "}
          <code>STRIPE_SECRET_KEY</code> and price IDs in the backend to enable checkout.
        </p>
      )}

      {showSubscribe && !compact && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {plans.map((plan) => (
            <article key={plan.id} className="mini-card">
              <h3>{plan.name}</h3>
              <p className="inline-badge priority-standard">£{plan.price_gbp_monthly} / month</p>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>{plan.description}</p>
              <button
                type="button"
                className="primary-action"
                style={{ marginTop: "0.75rem" }}
                disabled={busyPlan !== null}
                onClick={() => void onSubscribe(plan.id)}
              >
                {busyPlan === plan.id ? "Redirecting to Stripe…" : "Subscribe"}
              </button>
            </article>
          ))}
        </div>
      )}

      {compact && showSubscribe && (
        <Link className="primary-action" href="/clinic-admin/subscription">
          View plans &amp; subscribe
        </Link>
      )}

      {!compact && org?.subscription_status === "active" && stripeEnabled && (
        <button
          type="button"
          className="ghost-chip"
          style={{ marginTop: "1rem" }}
          onClick={() => void onManageBilling()}
        >
          Manage billing in Stripe
        </button>
      )}
    </article>
  );
}
