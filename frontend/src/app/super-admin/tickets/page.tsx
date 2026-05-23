import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { PlatformTicketsHub } from "../../../components/platform-tickets-hub";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";

export default function PlatformTicketsPage() {
  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Operations"
      title="Support tickets from clinics"
      navGroups={getSuperAdminNav("/super-admin/tickets")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <PlatformTicketsHub />
      </div>
    </RoleDashboardShell>
  );
}
