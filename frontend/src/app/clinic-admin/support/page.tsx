import { cookies } from "next/headers";

import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { SupportTicketForm } from "../../../components/support-ticket-form";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";

export default function ClinicAdminSupportPage() {
  const cookieStore = cookies();
  void cookieStore; // consumed for auth context — shell handles auth

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinic Admin"
      sectionLabel="Support"
      title="Platform support"
      navGroups={getClinicAdminNav("/clinic-admin/support")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <SupportTicketForm />
      </div>
    </RoleDashboardShell>
  );
}
