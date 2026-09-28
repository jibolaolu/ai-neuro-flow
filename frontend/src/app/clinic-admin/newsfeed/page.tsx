import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { NewsfeedContent } from "./NewsfeedContent";

export default function NewsfeedPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Communication"
      title="Staff Newsfeed"
      navGroups={getClinicAdminNav("/clinic-admin/newsfeed")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Staff Newsfeed</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Post announcements, updates, and information for your clinical team.
          </p>
        </div>
        <NewsfeedContent isAdmin />
      </div>
    </RoleDashboardShell>
  );
}
