import { initAuth0 } from "@auth0/nextjs-auth0";
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
  if (isAuth0Configured()) {
    // After Auth0 logout, land on the NeuroFlow /login page (not /api/auth/login,
    // which would immediately trigger a new Auth0 login flow).
    const returnTo = getSafeRedirectUrl(request, "/login").toString();
    const response = await initAuth0().handleLogout(request, { params: {} }, { returnTo });
    clearAppCookies(response);
    return response;
  }

  const response = NextResponse.redirect(getSafeRedirectUrl(request, "/login"));
  clearAppCookies(response);
  return response;
}
