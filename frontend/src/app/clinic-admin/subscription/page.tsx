import { ClinicSubscriptionPanelLazy } from "../../../components/clinic-subscription-panel-lazy";
import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";

export default function ClinicAdminSubscriptionPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Subscription"
      title="Manage your clinic subscription"
      navGroups={getClinicAdminNav("/clinic-admin/subscription")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <ClinicSubscriptionPanelLazy />
      </div>
    </RoleDashboardShell>
  );
}
