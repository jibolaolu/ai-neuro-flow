import { getAccessToken } from "@auth0/nextjs-auth0";
import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, displayCookieOptions } from "../../../../lib/cookie-options";
import { serverApiUrl } from "../../../../lib/get-api-base";
import {
  getSafeRedirectUrl,
  isMockRole,
  MOCK_ROLE_COOKIE,
  SESSION_START_COOKIE,
} from "../../../../lib/mock-auth";

const ROLE_MAP: Record<string, string> = {
  "super-platform-admin": "super-admin",
  "clinical-admin": "clinic-admin",
  "senior-clinician": "senior-clinician",
  clinician: "clinician",
};

const ROLE_PATHS: Record<string, string> = {
  "super-platform-admin": "/super-admin",
  "clinical-admin": "/clinic-admin",
  "senior-clinician": "/senior-clinician",
  clinician: "/clinician",
};

/** After Auth0 callback: copy access token into API cookie and redirect to dashboard. */
export async function GET(request: NextRequest) {
  let accessToken: string | undefined;
  try {
    const tokenRes = await getAccessToken();
    accessToken = tokenRes.accessToken;
  } catch {
    accessToken = undefined;
  }

  if (!accessToken) {
    return NextResponse.redirect(getSafeRedirectUrl(request, "/api/auth/login"));
  }

  const meRes = await fetch(serverApiUrl("/api/v1/auth/me"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    const baseUrl = process.env.AUTH0_BASE_URL ?? new URL(request.url).origin;
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("error", "no_account");
    return NextResponse.redirect(loginUrl);
  }

  const me = (await meRes.json()) as { role: string; full_name: string };
  const redirectPath = ROLE_PATHS[me.role] ?? "/";
  const frontendRole = ROLE_MAP[me.role] ?? me.role;

  const response = NextResponse.redirect(getSafeRedirectUrl(request, redirectPath));
  const authOpts = authCookieOptions(request);
  const displayOpts = displayCookieOptions(request);

  response.cookies.set("neuroflow_token", accessToken, authOpts);
  response.cookies.set("neuroaccess_token", "", { ...authOpts, maxAge: 0 });
  response.cookies.set("neuroflow_user", me.full_name, displayOpts);
  response.cookies.set(SESSION_START_COOKIE, String(Date.now()), displayOpts);

  if (isMockRole(frontendRole)) {
    response.cookies.set(MOCK_ROLE_COOKIE, frontendRole, displayOpts);
  }

  return response;
}
