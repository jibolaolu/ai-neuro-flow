import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { ClinicianSettingsContent } from "./ClinicianSettingsContent";

export default function ClinicianSettingsPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Account"
      title="My Account"
      navGroups={getClinicalStaffNav("clinician", "/clinician/settings")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>My Account</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Update your profile, contact details and notification preferences.</p>
        </div>
        <ClinicianSettingsContent />
      </div>
    </RoleDashboardShell>
  );
}
