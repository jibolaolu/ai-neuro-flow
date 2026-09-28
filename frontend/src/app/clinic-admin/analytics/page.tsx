import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { AnalyticsContent } from "./AnalyticsContent";

export default function AnalyticsPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Insights"
      title="Analytics"
      navGroups={getClinicAdminNav("/clinic-admin/analytics")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Platform Analytics</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Key metrics across assessments, clinician performance, and client outcomes.</p>
        </div>
        <AnalyticsContent />
      </div>
    </RoleDashboardShell>
  );
}
