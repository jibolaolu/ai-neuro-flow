import { cookies } from "next/headers";

import { ClinicalDashboardHome } from "../../components/clinical-dashboard-home";
import { RoleDashboardShell } from "../../components/role-dashboard-shell";
import { getMyAssignmentsList } from "../../lib/api-server";
import { getClinicalStaffNav } from "../../lib/clinical-staff-nav";

export default async function ClinicianPage() {
  const [assignments, cookieStore] = await Promise.all([getMyAssignmentsList(), cookies()]);
  const userName =
    cookieStore.get("neuroflow_user")?.value?.trim() ??
    cookieStore.get("neuroaccess_user")?.value?.trim() ??
    "";

  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Home"
      title=""
      navGroups={getClinicalStaffNav("clinician", "/clinician")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <ClinicalDashboardHome
          appointmentsHref="/clinician/appointments"
          assignments={assignments}
          userName={userName}
        />
      </div>
    </RoleDashboardShell>
  );
}
