import Link from "next/link";

import { AdminTeamManager } from "../../../../components/admin-team-manager";
import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";

export default function ClinicAdminNewTeamMemberPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinic Admin"
      sectionLabel="Add Team Member"
      title="Add or remove team members"
      navGroups={getClinicAdminNav("/clinic-admin/team")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <AdminTeamManager initialTeam={[]} />

        <section className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Next Steps</span>
              <h2>Team administration</h2>
            </div>
          </div>

          <article className="mini-card">
            <h3>Operational workflow</h3>
            <p>
              Once a new clinician is added, their availability appears in the admin calendar matrix and
              they can receive assigned assessments without altering the core AI workflow.
            </p>
            <div className="button-strip">
              <Link className="primary-action" href="/clinic-admin/team">
                Return to team
              </Link>
              <Link className="secondary-action" href="/clinic-admin/calendar">
                Review capacity matrix
              </Link>
            </div>
          </article>
        </section>
      </div>
    </RoleDashboardShell>
  );
}
