import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { SupportTicketForm } from "../../../components/support-ticket-form";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";

export default function ClinicianSupportPage() {
  return (
    <RoleDashboardShell
      role="clinician"
      roleLabel="Clinician"
      sectionLabel="Support"
      title="Platform support"
      navGroups={getClinicalStaffNav("clinician", "/clinician/support")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <SupportTicketForm />
      </div>
    </RoleDashboardShell>
  );
}
