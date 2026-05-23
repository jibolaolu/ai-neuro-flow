import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, displayCookieOptions } from "../../../../lib/cookie-options";
import { SESSION_START_COOKIE } from "../../../../lib/mock-auth";

const TOKEN_COOKIE = "neuroflow_token";
const USER_COOKIE = "neuroflow_user";
const LEGACY_TOKEN = "neuroaccess_token";

/** Set session cookies after signup (server-side, httpOnly token). */
export async function POST(request: NextRequest) {
  let body: { access_token?: string; full_name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { access_token, full_name, role } = body;
  if (!access_token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const authOpts = authCookieOptions(request);
  const displayOpts = displayCookieOptions(request);

  response.cookies.set(TOKEN_COOKIE, access_token, authOpts);
  response.cookies.set(LEGACY_TOKEN, "", { ...authOpts, maxAge: 0 });
  response.cookies.set(SESSION_START_COOKIE, String(Date.now()), displayOpts);
  if (full_name) {
    response.cookies.set(USER_COOKIE, full_name, displayOpts);
  }
  if (role) {
    response.cookies.set("neuroflow_mock_role", role === "clinical-admin" ? "clinic-admin" : role, displayOpts);
  }
  return response;
}
