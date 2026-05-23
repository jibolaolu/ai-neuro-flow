import { NextRequest, NextResponse } from "next/server";

import { getSafeRedirectUrl, MOCK_ROLE_COOKIE } from "../../../../lib/mock-auth";

export function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next") || "/login";
  const response = NextResponse.redirect(getSafeRedirectUrl(request, nextPath));
  response.cookies.delete(MOCK_ROLE_COOKIE);
  return response;
}
