import { cookies } from "next/headers";

import { RoleDashboardShell } from "../../components/role-dashboard-shell";
import { SuperAdminDashboard } from "../../components/super-admin-dashboard";
import { serverAuthedGetJson } from "../../lib/api-server";
import type { SystemStatus } from "../../lib/api";
import { getSuperAdminNav } from "../../lib/super-admin-nav";

export default async function SuperAdminPage() {
  const cookieStore = cookies();
  const userCookie = cookieStore.get("neuroflow_user");
  const userName = userCookie ? (() => {
    try { return JSON.parse(decodeURIComponent(userCookie.value)).name ?? "Platform Admin"; }
    catch { return "Platform Admin"; }
  })() : "Platform Admin";

  const systemStatus = await serverAuthedGetJson<SystemStatus>("/api/v1/system/status");

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Platform Control Plane"
      title="Monitor infrastructure, subscriptions, and platform health"
      navGroups={getSuperAdminNav("/super-admin")}
    >
      <div className="page-shell">
        <SuperAdminDashboard name={userName} systemStatus={systemStatus} />
      </div>
    </RoleDashboardShell>
  );
}
