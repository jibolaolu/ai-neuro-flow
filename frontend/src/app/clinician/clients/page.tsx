import { cookies } from "next/headers";

import { ClinicianPatientsTable } from "../../../components/clinician-patients-table";
import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getMyAssignmentsList } from "../../../lib/api-server";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../lib/mock-auth";

export default async function ClinicianClientsPage() {
  const cookieStore = await cookies();
  const staffRole =
    cookieStore.get(MOCK_ROLE_COOKIE)?.value === "senior-clinician" ? "senior-clinician" : "clinician";
  const mine = await getMyAssignmentsList();

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
      sectionLabel="Patients"
      title="Patients"
      navGroups={getClinicalStaffNav(staffRole, "/clinician/clients")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page" style={{ paddingTop: 0 }}>
        <ClinicianPatientsTable rows={mine} />
      </div>
    </RoleDashboardShell>
  );
}
