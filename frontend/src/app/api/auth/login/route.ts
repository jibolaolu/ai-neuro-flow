import { NextRequest, NextResponse } from "next/server";
import { initAuth0 } from "@auth0/nextjs-auth0";

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

const AUTH_ORIGIN_COOKIE = "_a0_origin";
const COOKIE_OPTS = "HttpOnly; SameSite=Lax; Secure; Max-Age=600; Path=/";

const audience = process.env.AUTH0_AUDIENCE;

/**
 * Derive the public-facing origin from request context.
 *
 * Priority:
 *  1. Referer header — present when user navigated from an app page (e.g. /login).
 *     For Cloudflare requests the Referer contains the eaglesoncloude.com origin.
 *  2. X-Forwarded-Host — cloudflared sets this; nginx preserves when map is configured.
 *  3. Host header — always the localtest.me hostname after nginx normalisation.
 */
function detectBaseUrl(req: NextRequest): string {
  const rawProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const fwdHost  = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHdr  = fwdHost || req.headers.get("host") || req.nextUrl.host;
  // localtest.me always expects https; everything else follows the real protocol.
  const proto = rawProto ?? (hostHdr.includes("localtest.me") ? "https" : req.nextUrl.protocol.replace(":", ""));

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (
        refOrigin &&
        !refOrigin.includes("localtest.me") &&
        !refOrigin.includes("localhost") &&
        !refOrigin.includes("127.0.0.1") &&
        !refOrigin.includes("auth0.com")
      ) {
        return refOrigin;
      }
    } catch {}
  }

  if (fwdHost && !fwdHost.includes("localtest.me") && !fwdHost.includes("localhost")) {
    return `${proto}://${fwdHost}`;
  }

  return `${proto}://${hostHdr}`;
}

// Auth0 sign-in (GET) — redirects to Auth0 hosted login page.
// This must live here because Next.js routes static segments before [auth0].
// prompt=login forces Auth0 to always show the login screen even when an
// existing Auth0 session is present (e.g. after our app session is cleared).
export async function GET(request: NextRequest) {
  const baseURL = detectBaseUrl(request);
  const auth0 = initAuth0({ baseURL });
  const loginRes = await auth0.handleLogin({
    returnTo: "/api/auth/sync",
    authorizationParams: {
      scope: "openid profile email",
      prompt: "login",
      ...(audience ? { audience } : {}),
    },
  })(request);
  // Store the detected origin so the callback handler (/api/auth/[auth0]) uses
  // the same baseURL for the token exchange redirect_uri.
  const headers = new Headers(loginRes.headers);
  headers.append("Set-Cookie", `${AUTH_ORIGIN_COOKIE}=${encodeURIComponent(baseURL)}; ${COOKIE_OPTS}`);
  return new Response(loginRes.body, { status: loginRes.status, headers });
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
