import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { MessagesContent } from "./MessagesContent";

export default function MessagesPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Communication"
      title="Messages"
      navGroups={getClinicAdminNav("/clinic-admin/messages")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Direct Messages</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Secure messaging between admin and clinical staff.
          </p>
        </div>
        <MessagesContent />
      </div>
    </RoleDashboardShell>
  );
}
