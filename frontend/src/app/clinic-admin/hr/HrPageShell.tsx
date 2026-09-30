import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";

export function HrPageShell({
  href,
  title,
  lead,
  children,
}: {
  href: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="HR"
      title={title}
      navGroups={getClinicAdminNav(href)}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{lead}</p>
        </div>
        {children}
      </div>
    </RoleDashboardShell>
  );
}
