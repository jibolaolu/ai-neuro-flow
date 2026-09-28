import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../../lib/clinical-staff-nav";
import { HrLeaveContent } from "../../../clinic-admin/hr/leave/HrLeaveContent";

export default function ClinicianLeavePage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="HR"
      title="Leave & Absence"
      navGroups={getClinicalStaffNav("clinician", "/clinician/hr/leave")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Leave & Absence</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Submit and track your leave requests.</p>
        </div>
        <HrLeaveContent isAdmin={false} />
      </div>
    </RoleDashboardShell>
  );
}
