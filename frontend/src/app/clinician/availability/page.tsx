import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { AvailabilityContent } from "../../../components/availability/availability-content";

export default function ClinicianAvailabilityPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Schedule"
      title="My Availability"
      navGroups={getClinicalStaffNav("clinician", "/clinician/availability")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <AvailabilityContent isAdmin={false} />
      </div>
    </RoleDashboardShell>
  );
}
