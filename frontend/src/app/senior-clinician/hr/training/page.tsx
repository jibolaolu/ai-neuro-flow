import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../../lib/clinical-staff-nav";
import { HrTrainingContent } from "../../../clinic-admin/hr/training/HrTrainingContent";

export default function SeniorClinicianTrainingPage() {
  return (
    <RoleDashboardShell
      role="senior-clinician"
      roleLabel="Senior Clinician"
      sectionLabel="HR"
      title="Training"
      navGroups={getClinicalStaffNav("senior-clinician", "/senior-clinician/hr/training")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Training</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Log and track your mandatory and optional training records.</p>
        </div>
        <HrTrainingContent />
      </div>
    </RoleDashboardShell>
  );
}
