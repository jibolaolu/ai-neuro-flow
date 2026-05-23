import { getAccessToken } from "@auth0/nextjs-auth0";
import { cookies } from "next/headers";

import { isAuth0Configured } from "./auth0-config";

/** Access token for backend API calls (Auth0 RS256 in prod, local JWT in dev). */
export async function getServerAccessToken(): Promise<string | null> {
  const store = await cookies();
  const cookieToken =
    store.get("neuroflow_token")?.value ?? store.get("neuroaccess_token")?.value;
  if (cookieToken) return cookieToken;

  if (!isAuth0Configured()) return null;

  try {
    const { accessToken } = await getAccessToken();
    return accessToken ?? null;
  } catch {
    return null;
  }
}
