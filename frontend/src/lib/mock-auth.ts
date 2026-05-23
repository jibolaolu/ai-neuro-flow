import type { NextRequest } from "next/server";

export const MOCK_ROLE_COOKIE = "neuroaccess_mock_role";
export const SESSION_START_COOKIE = "neuroflow_session_started_at";

export type MockRoleKey = "clinic-admin" | "clinician" | "senior-clinician" | "super-admin";

export const mockRoleLabels: Record<MockRoleKey, string> = {
  "clinic-admin": "Clinical Admin",
  "clinician": "Clinician",
  "senior-clinician": "Senior Clinician",
  "super-admin": "Super Platform Admin",
};

export function isMockRole(value: string): value is MockRoleKey {
  return (
    value === "clinic-admin" ||
    value === "clinician" ||
    value === "senior-clinician" ||
    value === "super-admin"
  );
}

export function getMockAuthHref(role: MockRoleKey, nextPath: string): string {
  const params = new URLSearchParams({ role, next: nextPath });
  return `/auth/mock?${params.toString()}`;
}

export function getSafeRedirectUrl(request: NextRequest, nextPath: string): URL {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
  const normalizedHost = hostHeader.replace(/^0\.0\.0\.0(?=[:/]|$)/, "localhost");
  const protocol =
    forwardedProto ??
    (normalizedHost.includes("localtest.me") ? "https" : request.nextUrl.protocol.replace(":", ""));
  return new URL(nextPath, `${protocol}://${normalizedHost}`);
}
