import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";
import { BrandingForm } from "./BrandingForm";

export default function ClinicBrandingPage() {
  const nav = getClinicAdminNav("/clinic-admin/settings/branding");
  return (
    <RoleDashboardShell navGroups={nav} role="clinic-admin" roleLabel="Clinical Admin" sectionLabel="Settings" title="Clinic Branding">
      <BrandingForm />
    </RoleDashboardShell>
  );
}
