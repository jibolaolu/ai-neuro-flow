"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserApiUrl } from "../lib/get-api-base";

type RevenueStats = {
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
  total_overdue: number;
  count_draft: number;
  count_sent: number;
  count_paid: number;
  count_overdue: number;
};

export function RevenueWidget() {
  const [stats, setStats] = useState<RevenueStats | null>(null);

  useEffect(() => {
    void fetch(browserApiUrl("/api/v1/invoices/stats"), { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<RevenueStats> : null)
      .then((d) => setStats(d));
  }, []);

  if (!stats) return null;

  const fmt = (n: number) =>
    n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${n.toFixed(0)}`;

  const items = [
    { label: "Billed",       value: fmt(stats.total_billed),      color: "var(--ink)",    count: stats.count_sent + stats.count_paid, href: "/clinic-admin/invoices" },
    { label: "Collected",    value: fmt(stats.total_paid),         color: "#22c55e",        count: stats.count_paid,    href: "/clinic-admin/invoices?status=paid" },
    { label: "Outstanding",  value: fmt(stats.total_outstanding),  color: "#f59e0b",        count: stats.count_sent,    href: "/clinic-admin/invoices?status=sent" },
    { label: "Overdue",      value: fmt(stats.total_overdue),      color: "#ef4444",        count: stats.count_overdue, href: "/clinic-admin/invoices?status=overdue" },
  ];

  return (
    <article className="workspace-card mini-card" style={{ marginBottom: 16 }}>
      <div className="workspace-card-header" style={{ marginBottom: 14 }}>
        <div>
          <span className="panel-label">Billing</span>
          <h3 style={{ margin: 0 }}>Revenue overview</h3>
        </div>
        <Link href="/clinic-admin/invoices" className="ghost-chip" style={{ fontSize: 12 }}>
          All invoices →
        </Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {items.map(({ label, value, color, count, href }) => (
          <Link
            key={label}
            href={href}
            style={{
              textDecoration: "none",
              background: "var(--muted-50)",
              border: "1px solid var(--card-border)",
              borderRadius: 10,
              padding: "12px 10px",
              textAlign: "center",
              display: "block",
              transition: "background 0.15s",
            }}
          >
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
            {count > 0 && (
              <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>{count} invoice{count !== 1 ? "s" : ""}</div>
            )}
          </Link>
        ))}
      </div>
    </article>
  );
}
