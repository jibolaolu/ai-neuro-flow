import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { NewsfeedContent } from "../../clinic-admin/newsfeed/NewsfeedContent";

export default function ClinicianNewsfeedPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Newsfeed"
      title="Newsfeed"
      navGroups={getClinicalStaffNav("clinician", "/clinician/newsfeed")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Newsfeed</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Team announcements and updates from the admin team.</p>
        </div>
        <NewsfeedContent isAdmin={false} />
      </div>
    </RoleDashboardShell>
  );
}
