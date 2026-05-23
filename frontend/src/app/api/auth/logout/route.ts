import { handleLogout } from "@auth0/nextjs-auth0";
import { NextRequest, NextResponse } from "next/server";

import { isAuth0Configured } from "../../../../lib/auth0-config";
import {
  getSafeRedirectUrl,
  MOCK_ROLE_COOKIE,
  SESSION_START_COOKIE,
} from "../../../../lib/mock-auth";

const APP_COOKIE_NAMES = [
  "neuroflow_token",
  "neuroaccess_token",
  "neuroflow_user",
  "neuroaccess_user",
  MOCK_ROLE_COOKIE,
  SESSION_START_COOKIE,
];

/** Append Set-Cookie headers that expire each app cookie, works on any Response. */
function clearAppCookies(response: Response): void {
  for (const name of APP_COOKIE_NAMES) {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
  }
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.AUTH0_BASE_URL ?? "http://localhost:3004";

  if (isAuth0Configured()) {
    // After Auth0 logout, send the user back to /api/auth/login so they land
    // directly on the Auth0 hosted sign-in page (login/page.tsx auto-redirects
    // there when no error param is present).
    const returnTo = new URL("/api/auth/login", baseUrl).toString();
    // Call Auth0 SDK logout directly — avoids redirect loop that happens when
    // redirecting to /api/auth/logout (this same static route shadows [auth0]).
    const response = await handleLogout(request, { params: {} }, { returnTo });
    clearAppCookies(response);
    return response;
  }

  const response = NextResponse.redirect(getSafeRedirectUrl(request, "/login"));
  clearAppCookies(response);
  return response;
}
