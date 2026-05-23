import { NextResponse } from "next/server";

import { getServerAccessToken } from "../../../../lib/server-access-token";

/** Returns the session access token for client-side authenticated API calls. */
export async function GET() {
  const token = await getServerAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
