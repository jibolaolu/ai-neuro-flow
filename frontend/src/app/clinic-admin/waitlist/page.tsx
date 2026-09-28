import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../lib/clinic-admin-nav";
import { WaitlistContent } from "./WaitlistContent";

export default function WaitlistPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Waitlist"
      title="Waiting List Management"
      navGroups={getClinicAdminNav("/clinic-admin/waitlist")}
    >
      <div className="section-page">
        <div className="section-page-header">
          <div>
            <span className="section-eyebrow">Operations</span>
            <h2>Waiting List</h2>
            <p className="section-lead">
              Monitor clients waiting for forms, clinician assignment, or appointment booking.
              Send targeted booking invites to move clients through the pathway.
            </p>
          </div>
        </div>
        <WaitlistContent />
      </div>
    </RoleDashboardShell>
  );
}
