import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { PoliciesContent } from "./PoliciesContent";

export default function PoliciesPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Communication"
      title="Policy Library"
      navGroups={getClinicAdminNav("/clinic-admin/policies")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Policy Library</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Manage and distribute clinical, HR, and operational policies to your team.
            Policies can be AI-generated or written manually.
          </p>
        </div>
        <PoliciesContent isAdmin />
      </div>
    </RoleDashboardShell>
  );
}
