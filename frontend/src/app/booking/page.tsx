import Link from "next/link";

import { SiteShell } from "../../components/site-shell";

/** Legacy URL from older emails; client booking now uses personalised /book/[token] links only. */
export default function LegacyBookingHubPage() {
  return (
    <SiteShell accent="sand">
      <main className="page-shell compact-shell" style={{ maxWidth: 640, margin: "0 auto" }}>
        <span className="eyebrow">Booking</span>
        <h1>This page is not used for client scheduling</h1>
        <p className="page-lead" style={{ color: "var(--text-muted)" }}>
          If you are a client, open the <strong>personal link</strong> from your email (subject line usually mentions
          choosing your assessment slot). It looks like{" "}
          <code style={{ fontSize: 13 }}>/book/…</code> on this site.
        </p>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
          Clinic staff can use the admin calendar and client records to manage availability and reminders.
        </p>
        <div className="hero-actions" style={{ marginTop: "1.5rem" }}>
          <Link className="ghost-chip" href="/login">
            Portal sign in
          </Link>
          <Link className="primary-action" href="/">
            Home
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
