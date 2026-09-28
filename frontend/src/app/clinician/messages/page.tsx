import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MessagesContent } from "../../clinic-admin/messages/MessagesContent";

export default function ClinicianMessagesPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Messages"
      title="Messages"
      navGroups={getClinicalStaffNav("clinician", "/clinician/messages")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Messages</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Direct messages with your admin team and colleagues.</p>
        </div>
        <MessagesContent />
      </div>
    </RoleDashboardShell>
  );
}
