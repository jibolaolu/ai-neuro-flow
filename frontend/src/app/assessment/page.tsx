import Link from "next/link";

import { SiteShell } from "../../components/site-shell";

/** Legacy public URL - clinical queue lives in the authenticated clinic admin app. */
export default function AssessmentLandingPage() {
  return (
    <SiteShell accent="teal">
      <main className="page-shell compact-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
        <span className="eyebrow">Assessments</span>
        <h1>Clinical assessment tracker</h1>
        <p className="page-lead" style={{ color: "var(--text-muted)" }}>
          Demo case data has been removed. Signed-in clinical admins should open{" "}
          <strong>Assessments</strong> from the clinic menu to see the live pipeline, or go to{" "}
          <strong>Clients</strong> for individual records.
        </p>
        <div className="hero-actions" style={{ marginTop: "1.5rem" }}>
          <Link className="primary-action" href="/login">
            Portal sign in
          </Link>
          <Link className="ghost-chip" href="/">
            Home
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
