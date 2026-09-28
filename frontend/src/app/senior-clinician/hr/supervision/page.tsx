import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../../lib/clinical-staff-nav";
import { HrSupervisionContent } from "../../../clinic-admin/hr/supervision/HrSupervisionContent";

export default function SeniorClinicianSupervisionPage() {
  return (
    <RoleDashboardShell
      role="senior-clinician"
      roleLabel="Senior Clinician"
      sectionLabel="HR"
      title="Supervision"
      navGroups={getClinicalStaffNav("senior-clinician", "/senior-clinician/hr/supervision")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Supervision</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Log and track your clinical supervision sessions.</p>
        </div>
        <HrSupervisionContent />
      </div>
    </RoleDashboardShell>
  );
}
