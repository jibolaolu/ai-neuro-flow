import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";
import { EmailTriageContent } from "./EmailTriageContent";

export default function EmailTriagePage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Communication"
      title="Email Triage"
      navGroups={getClinicAdminNav("/clinic-admin/comms/email-triage")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Email Triage</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>AI-categorised incoming emails. Review, action, or dismiss each item.</p>
        </div>
        <EmailTriageContent />
      </div>
    </RoleDashboardShell>
  );
}
