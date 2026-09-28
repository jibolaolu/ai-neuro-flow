import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../../lib/clinical-staff-nav";
import { HrIncidentsContent } from "../../../clinic-admin/hr/incidents/HrIncidentsContent";

export default function ClinicianIncidentsPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="HR"
      title="Incidents"
      navGroups={getClinicalStaffNav("clinician", "/clinician/hr/incidents")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>Incident Reports</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Report and track workplace incidents, near-misses, and concerns.</p>
        </div>
        <HrIncidentsContent isAdmin={false} />
      </div>
    </RoleDashboardShell>
  );
}
