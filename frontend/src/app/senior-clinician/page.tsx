import { cookies } from "next/headers";

import { ClinicalDashboardHome } from "../../components/clinical-dashboard-home";
import { RoleDashboardShell } from "../../components/role-dashboard-shell";
import { getMyAssignmentsList } from "../../lib/api-server";
import { getClinicalStaffNav } from "../../lib/clinical-staff-nav";

export default async function SeniorClinicianPage() {
  const [assignments, cookieStore] = await Promise.all([getMyAssignmentsList(), cookies()]);
  const userName =
    cookieStore.get("neuroflow_user")?.value?.trim() ??
    cookieStore.get("neuroaccess_user")?.value?.trim() ??
    "";

  return (
    <RoleDashboardShell
      role="senior-clinician"
      roleLabel="Senior Clinician"
      sectionLabel="Home"
      title="Home"
      navGroups={getClinicalStaffNav("senior-clinician", "/senior-clinician")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <ClinicalDashboardHome
          appointmentsHref="/senior-clinician/appointments"
          assignments={assignments}
          userName={userName}
          isSenior={true}
          basePath="/senior-clinician"
        />
      </div>
    </RoleDashboardShell>
  );
}
