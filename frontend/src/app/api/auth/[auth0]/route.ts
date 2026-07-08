import { initAuth0 } from "@auth0/nextjs-auth0";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Handles /api/auth/callback and /api/auth/logout.
// NOTE: /api/auth/login is handled by login/route.ts (static route takes
// priority over this dynamic segment in Next.js App Router).

const AUTH_ORIGIN_COOKIE = "_a0_origin";

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
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

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

  const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fwdHost && !fwdHost.includes("localtest.me") && !fwdHost.includes("localhost")) {
    return `${proto}://${fwdHost}`;
  }

  const host = fwdHost || req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}`;
}

function clearCookie(res: Response, name: string): Response {
  const headers = new Headers(res.headers);
  headers.append("Set-Cookie", `${name}=; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Path=/`);
  return new Response(res.body, { status: res.status, headers });
}

export async function GET(req: NextRequest, ctx: unknown) {
  const action = req.nextUrl.pathname.split("/").pop() ?? "";

  // --- CALLBACK ---
  if (action === "callback") {
    // Read the origin stored during login — critical for matching the redirect_uri
    // used in the /authorize request so Auth0 accepts the token exchange.
    const baseURL = req.cookies.get(AUTH_ORIGIN_COOKIE)?.value || detectBaseUrl(req);
    const auth0 = initAuth0({ baseURL });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callbackRes = await auth0.handleCallback(req, ctx as any);
      return clearCookie(callbackRes, AUTH_ORIGIN_COOKIE);
    } catch (error) {
      console.error("[adhd auth] callback error", error);
      const errRes = NextResponse.redirect(new URL("/login?authError=session-expired", baseURL));
      errRes.cookies.delete(AUTH_ORIGIN_COOKIE);
      return errRes;
    }
  }

  // --- LOGOUT ---
  if (action === "logout") {
    const baseURL = detectBaseUrl(req);
    const auth0 = initAuth0({ baseURL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return auth0.handleLogout({ returnTo: `${baseURL}/` })(req, ctx as any);
  }

  return NextResponse.json({ error: "Unknown auth action" }, { status: 404 });
}
