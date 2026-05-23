import { browserApiUrl } from "./get-api-base";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  subscription_status: string;
  subscription_plan: string | null;
  trial_ends_at: string | null;
};

export type SignupPayload = {
  organization_name: string;
  slug: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
};

export async function signupOrganization(payload: SignupPayload) {
  const res = await fetch(browserApiUrl("/api/v1/organizations/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail ?? "Signup failed";
    throw new Error(typeof detail === "string" ? detail : "Signup failed");
  }
  return data as {
    organization: Organization;
    access_token?: string;
    auth0_login_required?: boolean;
    redirect_path: string;
    full_name: string;
    role: string;
  };
}

export async function fetchMyOrganization(token: string): Promise<Organization> {
  const res = await fetch(browserApiUrl("/api/v1/organizations/me"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load organization");
  return res.json();
}
