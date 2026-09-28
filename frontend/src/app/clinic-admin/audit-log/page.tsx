import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { AuditLogContent } from "./AuditLogContent";

export default function AuditLogPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Governance"
      title="Audit Log"
      navGroups={getClinicAdminNav("/clinic-admin/audit-log")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Platform Audit Log</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Immutable record of significant platform events. Used for compliance, incident review, and governance.
          </p>
        </div>
        <AuditLogContent />
      </div>
    </RoleDashboardShell>
  );
}
