import Link from "next/link";

import { AdminClientManager } from "../../../../components/admin-client-manager";
import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";
import { BRAND } from "../../../../lib/branding";

export default function ClinicAdminNewClientPage() {
  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinical Admin"
      sectionLabel="Add Client"
      title="Add a client to your clinic"
      navGroups={getClinicAdminNav("/clinic-admin/clients")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <AdminClientManager initialClients={[]} />

        <section className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Intake</span>
              <h2>Manual client records</h2>
            </div>
          </div>
          <article className="mini-card">
            <p>
              Add clients directly in {BRAND.name}. Your clinic subscription covers platform access —
              patients are not charged by the platform.
            </p>
            <div className="button-strip">
              <Link className="secondary-action" href="/clinic-admin/clients">
                Return to clients
              </Link>
            </div>
          </article>
        </section>
      </div>
    </RoleDashboardShell>
  );
}
