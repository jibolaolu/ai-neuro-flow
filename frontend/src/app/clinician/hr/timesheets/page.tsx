import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../../lib/clinical-staff-nav";
import { HrTimesheetsContent } from "../../../clinic-admin/hr/timesheets/HrTimesheetsContent";

export default function ClinicianTimesheetsPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="HR"
      title="Timesheets"
      navGroups={getClinicalStaffNav("clinician", "/clinician/hr/timesheets")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Timesheets</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Submit your weekly hours for approval.</p>
        </div>
        <HrTimesheetsContent isAdmin={false} />
      </div>
    </RoleDashboardShell>
  );
}
