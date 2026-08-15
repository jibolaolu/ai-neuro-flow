import Link from "next/link";

import { SiteShell } from "../../components/site-shell";

/** Legacy marketing-style client URL - real clients use personalised links from email (/book/…, /forms/…). */
export default function ClientPortalLandingPage() {
  return (
    <SiteShell accent="sand">
      <main className="page-shell compact-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
        <span className="eyebrow">Client access</span>
        <h1>Your Neuro Flow journey</h1>
        <p className="page-lead" style={{ color: "var(--text-muted)" }}>
          Progress updates, forms, and booking use secure links sent to your email (they contain a unique token).
          If you need help, contact the clinic using the address on your correspondence.
        </p>
        <div className="hero-actions" style={{ marginTop: "1.5rem" }}>
          <Link className="primary-action" href="/login">
            Staff portal sign in
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
