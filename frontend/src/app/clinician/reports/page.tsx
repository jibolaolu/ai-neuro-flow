import { cookies } from "next/headers";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../lib/mock-auth";
import { ReportsContent } from "./reports-content";

export default async function ClinicianReportsPage() {
  const cookieStore = await cookies();
  const rawRole = cookieStore.get(MOCK_ROLE_COOKIE)?.value ?? "clinician";
  const staffRole = rawRole === "senior-clinician" ? "senior-clinician" : "clinician";
  const isSeniorClinician = staffRole === "senior-clinician";

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={isSeniorClinician ? "Senior Clinician" : "Clinician"}
      sectionLabel="Reports"
      title=""
      navGroups={getClinicalStaffNav(staffRole, "/clinician/reports")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page" style={{ paddingTop: 0 }}>
        <ReportsContent isSeniorClinician={isSeniorClinician} />
      </div>
    </RoleDashboardShell>
  );
}
