"use client";

import { useEffect, useRef, useState } from "react";
import { browserApiUrl } from "../../../../lib/get-api-base";

type Invoice = {
  id: string;
  client_name: string;
  client_email: string;
  invoice_number: string | null;
  description: string;
  amount_gbp: number;
  vat_rate: number;
  total_gbp: number;
  status: string;
  stripe_payment_link: string | null;
  invoice_date: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

export default function InvoicePrintPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch(browserApiUrl(`/api/v1/invoices/${params.id}`), { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<Invoice> : null)
      .then((d) => { setInvoice(d); setLoading(false); });
  }, [params.id]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;
  if (!invoice) return <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>Invoice not found.</div>;

  const vatAmount = invoice.amount_gbp * invoice.vat_rate;
  const fmt = (n: number) => `£${n.toFixed(2)}`;
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const statusColor: Record<string, string> = {
    draft: "#94a3b8", sent: "#3b82f6", paid: "#22c55e", overdue: "#ef4444", void: "#6b7280",
  };

  return (
    <div style={{ background: "var(--body-bg)", minHeight: "100vh", padding: "24px 16px" }}>
      {/* Print controls — hidden when printing */}
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 20, maxWidth: 780, margin: "0 auto 20px" }}>
        <a href="/clinic-admin/invoices" style={{ color: "var(--brand)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
          ← Back to invoices
        </a>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => window.print()}
          style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* Invoice document */}
      <div ref={printRef} style={{
        background: "#fff",
        maxWidth: 780,
        margin: "0 auto",
        borderRadius: 16,
        boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
        padding: "48px 52px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#1d4ed8", letterSpacing: "-0.02em", marginBottom: 4 }}>
              Neuro Flow
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Clinical Platform</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Invoice
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
              {invoice.invoice_number ?? invoice.id}
            </div>
            <div style={{
              display: "inline-block",
              background: `${statusColor[invoice.status] ?? "#94a3b8"}22`,
              color: statusColor[invoice.status] ?? "#94a3b8",
              border: `1px solid ${statusColor[invoice.status] ?? "#94a3b8"}55`,
              borderRadius: 6,
              padding: "2px 10px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              marginTop: 6,
            }}>
              {invoice.status}
            </div>
          </div>
        </div>

        {/* Bill to / dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 8 }}>Bill To</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>{invoice.client_name}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{invoice.client_email}</div>
          </div>
          <div>
            {[
              ["Invoice Date", fmtDate(invoice.invoice_date)],
              ["Due Date", fmtDate(invoice.due_date)],
              ...(invoice.paid_at ? [["Paid On", fmtDate(invoice.paid_at)]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: 32 }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Description</span>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", textAlign: "right" }}>Subtotal</span>
          </div>
          {/* Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, padding: "18px 20px" }}>
            <span style={{ fontSize: 14, color: "#0f172a" }}>{invoice.description}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>{fmt(invoice.amount_gbp)}</span>
          </div>
          {/* VAT row */}
          {invoice.vat_rate > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, padding: "10px 20px", borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>VAT ({(invoice.vat_rate * 100).toFixed(0)}%)</span>
              <span style={{ fontSize: 13, color: "#64748b", textAlign: "right" }}>{fmt(vatAmount)}</span>
            </div>
          )}
          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: "#1d4ed8", borderTop: "2px solid #1d4ed8" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{fmt(invoice.total_gbp)}</span>
          </div>
        </div>

        {/* Payment link */}
        {invoice.stripe_payment_link && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#16a34a", marginBottom: 6 }}>Pay online</div>
            <a href={invoice.stripe_payment_link} style={{ fontSize: 13, color: "#1d6a3a", wordBreak: "break-all" }}>
              {invoice.stripe_payment_link}
            </a>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{invoice.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Thank you for your business · Neuro Flow Clinical Platform
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>
            Invoice ID: {invoice.id}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          * { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
