import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { SupportTicketForm } from "../../../components/support-ticket-form";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";

export default function SeniorClinicianSupportPage() {
  return (
    <RoleDashboardShell
      role="senior-clinician"
      roleLabel="Senior Clinician"
      sectionLabel="Support"
      title="Platform support"
      navGroups={getClinicalStaffNav("senior-clinician", "/senior-clinician/support")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <SupportTicketForm />
      </div>
    </RoleDashboardShell>
  );
}
