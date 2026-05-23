import Link from "next/link";

import { SiteShell } from "../../components/site-shell";
import { BRAND } from "../../lib/branding";

/** Legacy integration docs — WooCommerce intake is disabled on standalone Neuro Flow. */
export default function LegacyIntegrationPage() {
  return (
    <SiteShell accent="sand">
      <main className="landing-shell compact-shell">
        <section className="page-hero compact-hero">
          <div className="page-hero-copy">
            <span className="eyebrow">Legacy integration</span>
            <h1>External shop webhooks are disabled</h1>
            <p className="page-lead">
              {BRAND.name} runs as a standalone clinic platform. Patient payments through external
              WordPress shops are no longer used. Clinics add clients manually or via referral import;
              your clinic pays one {BRAND.name} subscription.
            </p>
            <div className="hero-actions">
              <Link className="primary-action" href="/signup">
                Register your clinic
              </Link>
              <Link className="secondary-action" href="/clinic-admin">
                Clinic admin
              </Link>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
