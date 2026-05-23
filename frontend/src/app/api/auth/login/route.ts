import { NextRequest, NextResponse } from "next/server";
import { handleLogin } from "@auth0/nextjs-auth0";

import { authCookieOptions, displayCookieOptions } from "../../../../lib/cookie-options";
import { isAuth0Configured } from "../../../../lib/auth0-config";
import { serverApiUrl } from "../../../../lib/get-api-base";
import {
  getSafeRedirectUrl,
  isMockRole,
  MOCK_ROLE_COOKIE,
  SESSION_START_COOKIE,
} from "../../../../lib/mock-auth";

// Maps backend role strings to the frontend MockRoleKey used by site-shell
const ROLE_MAP: Record<string, string> = {
  "super-platform-admin": "super-admin",
  "clinical-admin": "clinic-admin",
  "senior-clinician": "senior-clinician",
  "clinician": "clinician",
};

const audience = process.env.AUTH0_AUDIENCE;

// Auth0 sign-in (GET) — redirects to Auth0 hosted login page.
// This must live here because Next.js routes static segments before [auth0].
// prompt=login forces Auth0 to always show the login screen even when an
// existing Auth0 session is present (e.g. after our app session is cleared).
const auth0Login = handleLogin({
  returnTo: "/api/auth/sync",
  authorizationParams: {
    scope: "openid profile email",
    prompt: "login",
    ...(audience ? { audience } : {}),
  },
}) as unknown as (request: NextRequest) => Promise<Response>;

export function GET(request: NextRequest) {
  return auth0Login(request);
}

// JWT password login (POST) — dev-only fallback when Auth0 is not configured
export async function POST(request: NextRequest) {
  if (isAuth0Configured()) {
    return NextResponse.json(
      { error: "Password login is disabled. Use Auth0 sign in." },
      { status: 403 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  let backendData: { access_token: string; role: string; full_name: string; redirect_path: string };
  try {
    const res = await fetch(serverApiUrl("/api/v1/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw = (err as { detail?: unknown }).detail;
      const message =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
          ? (raw as { msg?: string }[]).map((e) => e.msg ?? "Validation error").join(", ")
          : "Invalid email or password";
      return NextResponse.json({ error: message }, { status: res.status });
    }

    backendData = await res.json();
  } catch {
    return NextResponse.json({ error: "Could not reach the authentication server" }, { status: 502 });
  }

  const frontendRole = ROLE_MAP[backendData.role] ?? backendData.role;
  const redirectPath = backendData.redirect_path ?? "/";
  const redirectUrl = getSafeRedirectUrl(request, redirectPath).toString();

  const response = NextResponse.json({ redirect: redirectPath });

  // Set the role cookie so site-shell can display the user's role
  const displayOpts = displayCookieOptions(request);
  const authOpts = authCookieOptions(request);

  if (isMockRole(frontendRole)) {
    response.cookies.set(MOCK_ROLE_COOKIE, frontendRole, displayOpts);
  }

  response.cookies.set("neuroflow_token", backendData.access_token, authOpts);
  response.cookies.set("neuroaccess_token", "", { ...authOpts, maxAge: 0 });
  response.cookies.set(SESSION_START_COOKIE, String(Date.now()), displayOpts);

  response.cookies.set("neuroflow_user", backendData.full_name, displayOpts);

  void redirectUrl; // redirect handled client-side via JSON response
  return response;
}
