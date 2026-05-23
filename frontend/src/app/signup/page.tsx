import Link from "next/link";

import { BRAND } from "../../lib/branding";
import { SiteShell } from "../../components/site-shell";
import { SignupForm } from "./SignupForm";

const FEATURES = [
  "Unlimited assessments during your 14-day trial",
  "NICE-aligned ADHD & autism assessment workflows",
  "Role-based access for your whole clinical team",
  "Auto-generated PDF diagnostic reports",
  "GDPR-compliant — data stored in the UK",
  "One clinic subscription — patients are never charged",
];

export default function SignupPage() {
  return (
    <SiteShell accent="slate" hideFooter>
      <div className="su-page">

        {/* ── Left panel ── */}
        <div className="su-left">
          <div className="su-left-inner">
            <div className="su-trial-badge">14-day free trial · No credit card required</div>

            <h1 className="su-headline">
              Clinical assessments,<br />done properly.
            </h1>
            <p className="su-sub">
              Give your clinic NICE-aligned ADHD and autism assessment workflows,
              multi-clinician scheduling, and automated reports — all in one
              secure platform.
            </p>

            <ul className="su-features">
              {FEATURES.map((f) => (
                <li key={f}>
                  <span className="su-check">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="2,8 6,12 14,4" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <blockquote className="su-quote">
              <p>"Set up in under 10 minutes. Our intake process is now fully paperless."</p>
              <cite>— Clinical Director, Neurodevelopmental Assessment Clinic</cite>
            </blockquote>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="su-right">
          <div className="su-card">
            <div className="su-card-head">
              <h2>Create your workspace</h2>
              <p>Get your clinic set up and running in minutes.</p>
            </div>

            <SignupForm />

            <p className="su-signin">
              Already have an account?{" "}
              <Link href="/login">Sign in</Link>
            </p>
          </div>
        </div>

      </div>
    </SiteShell>
  );
}
