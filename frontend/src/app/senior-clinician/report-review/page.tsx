import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { ReviewQueue } from "./review-queue";

export default function SeniorReportReviewPage() {
  return (
    <RoleDashboardShell
      role="senior-clinician"
      roleLabel="Senior Clinician"
      sectionLabel="Report review"
      title="Awaiting report review"
      navGroups={getClinicalStaffNav("senior-clinician", "/senior-clinician/report-review")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <section className="page-hero compact-hero" style={{ marginBottom: "var(--space-4)" }}>
          <div className="page-hero-copy">
            <span className="eyebrow">Quality gate</span>
            <h1 className="page-lead-heading">Reports awaiting senior sign-off</h1>
            <p className="page-lead">
              Reports submitted by clinicians appear here once they are ready for your review.
              You cannot approve your own reports — only reports authored by other clinicians.
              Approve to mark as <strong>Complete</strong>, or return with comments for revision.
            </p>
          </div>
        </section>

        <article className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Review queue</span>
              <h2>Pending reports</h2>
            </div>
          </div>

          <ReviewQueue />
        </article>
      </div>
    </RoleDashboardShell>
  );
}
