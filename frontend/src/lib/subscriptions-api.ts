import { browserApiUrl } from "./get-api-base";

export type Plan = {
  id: string;
  name: string;
  description: string;
  price_gbp_monthly: number;
};

export async function fetchPlans() {
  const res = await fetch(browserApiUrl("/api/v1/subscriptions/plans"), { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load plans");
  return res.json() as Promise<{
    plans: Plan[];
    stripe_enabled: boolean;
    trial_days: number;
  }>;
}

export async function createCheckout(token: string, plan: string) {
  const res = await fetch(browserApiUrl("/api/v1/subscriptions/checkout"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { detail?: string }).detail ?? "Checkout failed");
  }
  return data as { checkout_url: string };
}

export async function openBillingPortal(token: string) {
  const res = await fetch(browserApiUrl("/api/v1/subscriptions/portal"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { detail?: string }).detail ?? "Portal unavailable");
  }
  return data as { portal_url: string };
}
