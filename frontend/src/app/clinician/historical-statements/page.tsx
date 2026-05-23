import { cookies } from "next/headers";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../lib/mock-auth";

export default async function ClinicianHistoricalStatementsPage() {
  const cookieStore = await cookies();
  const staffRole =
    cookieStore.get(MOCK_ROLE_COOKIE)?.value === "senior-clinician" ? "senior-clinician" : "clinician";

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
      sectionLabel="Historical Statements"
      title="Historical Statements"
      navGroups={getClinicalStaffNav(staffRole, "/clinician/historical-statements")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <p style={{ color: "var(--muted)", margin: "0 0 1rem", fontSize: "0.95rem" }}>
          Downloadable statements and historical payment summaries will appear here when available from Clinical Admin.
        </p>
        <div
          className="detail-callout"
          style={{
            borderColor: "#e9d5ff",
            background: "#faf5ff",
          }}
        >
          <strong style={{ color: "#5b21b6" }}>No statements yet</strong>
          <p style={{ margin: "8px 0 0", color: "#6b21a8" }}>
            You have no historical statements on file.
          </p>
        </div>
      </div>
    </RoleDashboardShell>
  );
}
