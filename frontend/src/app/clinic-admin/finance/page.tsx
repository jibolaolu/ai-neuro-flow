import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { ClinicAdminFinanceQueue } from "../../../components/clinic-admin-finance-queue";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";

export default async function ClinicAdminFinancePage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinic Admin"
      sectionLabel="Finance"
      title="Contractor invoices"
      navGroups={getClinicAdminNav("/clinic-admin/finance")}
    >
      <div className="page-shell dashboard-page-shell compact-shell" style={{ paddingTop: 0 }}>
        <ClinicAdminFinanceQueue />
      </div>
    </RoleDashboardShell>
  );
}
