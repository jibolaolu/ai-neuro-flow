import Link from "next/link";

import { SiteShell } from "../../components/site-shell";
import { PLANS } from "../../lib/plans";
import { fetchPlans } from "../../lib/subscriptions-api";

export default async function PricingPage() {
  let trialDays = 14;
  try {
    const data = await fetchPlans();
    trialDays = data.trial_days ?? 14;
  } catch {
    // API unavailable — use static plan data and default trial days
  }

  return (
    <SiteShell accent="sand">
      <main>

        {/* ── Hero ── */}
        <section className="nfPricingWrap" style={{ borderTop: "none", background: "transparent" }}>
          <div className="nfPricingInner" style={{ paddingBottom: "0" }}>
            <div className="nfSectionIntro">
              <span>Pricing</span>
              <h1 style={{ fontSize: "2.25rem", margin: "0.5rem 0 0.75rem" }}>
                Simple, transparent plans for every clinic
              </h1>
              <p>
                No setup fees. No per-seat surprises. Start with a {trialDays}-day free trial
                on any plan — cancel any time.
              </p>
            </div>
          </div>
        </section>

        {/* ── Plan cards ── */}
        <section className="nfPricingWrap">
          <div className="nfPricingInner" style={{ paddingTop: "1.5rem" }}>
            <div className="nfPricingGrid">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={
                    plan.featured
                      ? "nfPricingCard nfPricingCardFeatured"
                      : "nfPricingCard"
                  }
                >
                  {plan.featured && (
                    <div className="nfPricingPopular">Most popular</div>
                  )}

                  <div className="nfPricingHead">
                    <h2 className="nfPricingName">{plan.name}</h2>
                    <p className="nfPricingDesc">{plan.description}</p>
                  </div>

                  <div className="nfPricingPrice">
                    {plan.period ? (
                      <>
                        <span className="nfPricingAmount">{plan.price}</span>
                        <span className="nfPricingPeriod">{plan.period}</span>
                      </>
                    ) : (
                      <span className="nfPricingAmount">{plan.price}</span>
                    )}
                  </div>
                  {plan.billing && (
                    <p className="nfPricingBilling">{plan.billing}</p>
                  )}

                  <ul className="nfPricingFeatures">
                    {plan.features.map((f) => (
                      <li
                        key={f.text}
                        className={
                          f.highlight
                            ? "nfPricingFeature nfPricingFeatureHighlight"
                            : "nfPricingFeature"
                        }
                      >
                        <span className="nfPricingCheck" aria-hidden>✓</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    className={
                      plan.featured
                        ? "primary-action nfPricingCta"
                        : "secondary-action nfPricingCta"
                    }
                  >
                    {plan.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>

            <p className="nfPricingNote">
              All plans include GDPR-compliant data handling, Auth0 identity, and NICE-aligned workflows.
              <br />
              Need a custom quote?{" "}
              <Link href="/contact">Talk to the team →</Link>
            </p>
          </div>
        </section>

        {/* ── Trust strip ── */}
        <section
          style={{
            background: "#f8fafc",
            borderTop: "1px solid var(--card-border)",
            padding: "2.5rem 2rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              maxWidth: "640px",
              margin: "0 auto",
              fontSize: "0.9rem",
              color: "var(--muted)",
              lineHeight: "1.7",
            }}
          >
            Your clinic subscribes — patients are <strong>never</strong> charged by the platform.
            All data is stored in UK datacentres. Fully GDPR-compliant. Aligned with NICE NG87
            and CQC inspection frameworks.
          </p>
        </section>

      </main>
    </SiteShell>
  );
}
