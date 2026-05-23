import Link from "next/link";
import type { ReactNode } from "react";

import { SiteShell } from "./site-shell";

type DetailCard = {
  title: string;
  body: string;
};

type MetricCard = {
  label: string;
  value: string;
};

export function SectionPage({
  eyebrow,
  title,
  lead,
  accent = "teal",
  metrics,
  details,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  accent?: "teal" | "sand" | "slate";
  metrics: MetricCard[];
  details: DetailCard[];
  actionHref: string;
  actionLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  children?: ReactNode;
}) {
  return (
    <SiteShell accent={accent}>
      <main className="page-shell">
        <section className="page-hero">
          <div className="page-hero-copy">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="page-lead">{lead}</p>

            <div className="hero-actions">
              <Link className="primary-action" href={actionHref}>
                {actionLabel}
              </Link>
              <Link className="secondary-action" href={secondaryHref}>
                {secondaryLabel}
              </Link>
            </div>
          </div>

          <div className="metrics-strip">
            {metrics.map((metric) => (
              <article className="snapshot-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-grid">
          {details.map((detail) => (
            <article className="detail-card" key={detail.title}>
              <h2>{detail.title}</h2>
              <p>{detail.body}</p>
            </article>
          ))}
        </section>

        {children}
      </main>
    </SiteShell>
  );
}
