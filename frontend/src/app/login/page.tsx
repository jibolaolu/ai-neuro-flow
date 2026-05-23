import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SiteShell } from "../../components/site-shell";
import { BRAND } from "../../lib/branding";
import { isAuth0Configured } from "../../lib/auth0-config";
import { LoginForm } from "./LoginForm";

type Props = {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const auth0 = isAuth0Configured();
  const params = await searchParams;

  // When Auth0 is configured and there is no error to display, go straight to
  // the Auth0 hosted login page — no intermediate "Sign in with Auth0" button needed.
  if (auth0 && !params.error) {
    const returnTo = params.returnTo ?? "/api/auth/sync";
    redirect(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <SiteShell accent="slate">
      <main className="auth-shell compact-shell">

        <section className="page-hero compact-hero">
          <div className="page-hero-copy">
            <span className="eyebrow">{BRAND.name} — Secure sign in</span>
            <h1>Access your clinical workspace.</h1>
            <p className="page-lead">
              {auth0
                ? "Sign in securely with Auth0. Your dashboard is determined by your assigned role."
                : "Sign in with your email and password. Your dashboard is determined automatically by your assigned role."}
            </p>
          </div>
        </section>

        <section className="workspace-grid">

          <article className="workspace-card">
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Staff &amp; Clinician Login</span>
                <h2>Sign in</h2>
              </div>
            </div>

            <Suspense fallback={<p>Loading…</p>}>
              <LoginForm auth0={auth0} />
            </Suspense>

            <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Having trouble signing in?{" "}
              <a href={`mailto:${BRAND.supportEmail}`}>Contact support</a>
            </p>
          </article>

          <article className="workspace-card workspace-detail">
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Access guide</span>
                <h2>Who can sign in?</h2>
              </div>
            </div>

            <div className="workflow-stack">
              <article className="mini-card">
                <h3>Clinical Admin</h3>
                <p>
                  Manage intake queue, booking schedules, clinician allocation,
                  and report release for your clinic.
                </p>
              </article>
              <article className="mini-card">
                <h3>Senior Clinician</h3>
                <p>
                  All clinician functions plus sign-off authority for diagnostic
                  reports and junior clinician oversight.
                </p>
              </article>
              <article className="mini-card">
                <h3>Clinician</h3>
                <p>
                  View assigned client cases, upload clinical notes, manage
                  availability, and submit timesheets.
                </p>
              </article>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link className="ghost-chip" href="/signup">
                Register your clinic
              </Link>
              <Link className="ghost-chip" href="/">
                ← Back to home
              </Link>
            </div>
          </article>

        </section>
      </main>
    </SiteShell>
  );
}
