import { cookies } from "next/headers";

import { ClinicalAppointmentSubtabs } from "../../../components/clinical-appointment-subtabs";
import { ClinicianAssessmentsHub } from "../../../components/clinician-assessments-hub";
import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../lib/mock-auth";

function parseTab(raw: string | undefined): "upcoming" | "pending" | "history" {
  if (raw === "pending" || raw === "history") return raw;
  return "upcoming";
}

export default async function ClinicianAppointmentsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const cookieStore = await cookies();
  const staffRole =
    cookieStore.get(MOCK_ROLE_COOKIE)?.value === "senior-clinician" ? "senior-clinician" : "clinician";
  const tab = parseTab(searchParams?.tab);

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
      sectionLabel="Appointments"
      title="Appointments"
      navGroups={getClinicalStaffNav(staffRole, "/clinician/appointments")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <ClinicalAppointmentSubtabs active={tab} />
        <div className="clinical-search-field clinical-search-field--compact">
          <label className="sr-only" htmlFor="appt-search-hint">
            Search hint
          </label>
          <p id="appt-search-hint" className="clinical-page-lead">
            Use the filters below to narrow by status and registration date. Tabs group your caseload into upcoming work,
            items awaiting action, and completed history.
          </p>
        </div>
        <ClinicianAssessmentsHub workflowTab={tab} />
      </div>
    </RoleDashboardShell>
  );
}
