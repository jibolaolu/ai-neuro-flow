import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, displayCookieOptions } from "../../../lib/cookie-options";
import { serverApiBase } from "../../../lib/get-api-base";
import {
  getSafeRedirectUrl,
  isMockRole,
  MOCK_ROLE_COOKIE,
  SESSION_START_COOKIE,
} from "../../../lib/mock-auth";

// Seed credentials that match backend/app/seed.py
const MOCK_CREDENTIALS: Record<string, { email: string; password: string; name: string }> = {
  "clinic-admin":      { email: "clinicaladmin@neuroflow.test",  password: "ClinicalAdmin@2024!", name: "Sarah Mitchell" },
  "senior-clinician":  { email: "seniorclinician@neuroflow.test", password: "SeniorClin@2024!",   name: "Dr James Okafor" },
  "clinician":         { email: "clinician@neuroflow.test",       password: "Clinician@2024!",     name: "Dr Maya Patel" },
  "super-admin":       { email: "superadmin@neuroflow.test",      password: "SuperAdmin@2024!",    name: "Alex Thornton" },
};

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.redirect(getSafeRedirectUrl(request, "/login"));
  }

  const role = request.nextUrl.searchParams.get("role");
  const nextPath = request.nextUrl.searchParams.get("next") || "/";

  if (!role || !isMockRole(role)) {
    return NextResponse.redirect(getSafeRedirectUrl(request, "/login"));
  }

  const response = NextResponse.redirect(getSafeRedirectUrl(request, nextPath));
  const displayOpts = { ...displayCookieOptions(request), maxAge: 60 * 60 * 8 };
  const authOpts = { ...authCookieOptions(request), maxAge: 60 * 60 * 8 };

  response.cookies.set(MOCK_ROLE_COOKIE, role, displayOpts);

  // Fetch a real JWT from the backend so server components can call authenticated APIs.
  // Try the role-specific seed user first; on any failure fall back to the clinical-admin
  // seed user (broadest permissions) so admin pages always stay usable.
  const creds = MOCK_CREDENTIALS[role];
  const fallback = MOCK_CREDENTIALS["clinic-admin"];

  async function fetchToken(c: { email: string; password: string; name: string }) {
    const res = await fetch(`${serverApiBase()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, password: c.password }),
    });
    if (!res.ok) throw new Error(`Login returned ${res.status}`);
    return { data: (await res.json()) as { access_token: string }, name: c.name };
  }

  let token: string | null = null;
  let displayName = creds?.name ?? "";

  if (creds) {
    try {
      const result = await fetchToken(creds);
      token = result.data.access_token;
      displayName = result.name;
    } catch (e) {
      console.warn(`[mock-auth] Primary login failed for role "${role}":`, e);
      // Fallback to clinic-admin so admin pages still work
      if (fallback && role !== "clinic-admin") {
        try {
          const result = await fetchToken(fallback);
          token = result.data.access_token;
          // Keep displayName as the selected role's name for the greeting
        } catch (e2) {
          console.error("[mock-auth] Fallback login also failed:", e2);
        }
      }
    }
  }

  if (token) {
    response.cookies.set("neuroflow_token", token, authOpts);
  }
  if (displayName) {
    response.cookies.set("neuroflow_user", displayName, displayOpts);
  }
  response.cookies.set(SESSION_START_COOKIE, String(Date.now()), displayOpts);

  return response;
}
