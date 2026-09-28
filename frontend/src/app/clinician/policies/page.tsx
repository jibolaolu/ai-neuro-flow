import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { PoliciesContent } from "../../clinic-admin/policies/PoliciesContent";

export default function ClinicianPoliciesPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Policies"
      title="Policies"
      navGroups={getClinicalStaffNav("clinician", "/clinician/policies")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Policy Library</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>View clinic policies and procedures relevant to your role.</p>
        </div>
        <PoliciesContent isAdmin={false} />
      </div>
    </RoleDashboardShell>
  );
}
