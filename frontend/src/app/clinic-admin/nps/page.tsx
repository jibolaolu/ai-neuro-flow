import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { NpsContent } from "./NpsContent";

export default function NpsPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Insights"
      title="NPS & Client Feedback"
      navGroups={getClinicAdminNav("/clinic-admin/nps")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>
            NPS &amp; Client Satisfaction
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            Net Promoter Score and satisfaction ratings collected post-assessment.
            Surveys are automatically sent when a report is issued. Supports CQC quality compliance.
          </p>
        </div>
        <NpsContent />
      </div>
    </RoleDashboardShell>
  );
}
