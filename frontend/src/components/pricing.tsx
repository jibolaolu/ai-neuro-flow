import Link from "next/link";

import { PLANS } from "../lib/plans";

export function PricingSection() {
  return (
    <section id="pricing" className="nfPricingWrap">
      <div className="nfPricingInner">
        <div className="nfSectionIntro">
          <span>Pricing</span>
          <h2>Simple, transparent plans for every clinic</h2>
          <p>
            No setup fees. No per-seat surprises. Start with a 14-day free trial
            on any plan — cancel any time.
          </p>
        </div>

        <div className="nfPricingGrid">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={plan.featured ? "nfPricingCard nfPricingCardFeatured" : "nfPricingCard"}
            >
              {plan.featured && (
                <div className="nfPricingPopular">Most popular</div>
              )}

              <div className="nfPricingHead">
                <h3 className="nfPricingName">{plan.name}</h3>
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
                    className={f.highlight ? "nfPricingFeature nfPricingFeatureHighlight" : "nfPricingFeature"}
                  >
                    <span className="nfPricingCheck" aria-hidden>✓</span>
                    {f.text}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={plan.featured ? "primary-action nfPricingCta" : "secondary-action nfPricingCta"}
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
  );
}
