"use client";

import { useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";

type Invoice = {
  id: string;
  client_id: string | null;
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
  created_at: string | null;
  notes: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft:   "#94a3b8",
  sent:    "#3b82f6",
  paid:    "#22c55e",
  overdue: "#ef4444",
  void:    "#6b7280",
};

function statusBadge(s: string) {
  const col = STATUS_COLORS[s] ?? "#94a3b8";
  return (
    <span style={{
      background: `${col}22`,
      color: col,
      border: `1px solid ${col}55`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "capitalize" as const,
    }}>{s}</span>
  );
}

type NewForm = {
  client_name: string;
  client_email: string;
  description: string;
  amount_gbp: string;
  vat_rate: string;
  due_days: string;
  notes: string;
};

const BLANK: NewForm = {
  client_name: "", client_email: "", description: "",
  amount_gbp: "", vat_rate: "0", due_days: "30", notes: "",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<NewForm>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [markPaidRef, setMarkPaidRef] = useState("");

  async function load() {
    setLoading(true);
    try {
      const url = filter === "all"
        ? browserApiUrl("/api/v1/invoices/")
        : browserApiUrl(`/api/v1/invoices/?status=${filter}`);
      const r = await fetch(url, { credentials: "include" });
      if (r.ok) {
        const d = await r.json() as { items: Invoice[] };
        setInvoices(d.items);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(browserApiUrl("/api/v1/invoices/"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: form.client_name,
          client_email: form.client_email,
          description: form.description,
          amount_gbp: parseFloat(form.amount_gbp),
          vat_rate: parseFloat(form.vat_rate),
          due_days: parseInt(form.due_days, 10),
          notes: form.notes || undefined,
        }),
      });
      if (r.ok) {
        setShowNew(false);
        setForm({ ...BLANK });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(inv: Invoice) {
    setActionBusy(inv.id + "-send");
    try {
      const r = await fetch(browserApiUrl(`/api/v1/invoices/${inv.id}/send`), {
        method: "POST", credentials: "include",
      });
      if (r.ok) { const d = await r.json() as Invoice; setSelected(d); await load(); }
    } finally { setActionBusy(null); }
  }

  async function handleMarkPaid(inv: Invoice) {
    setActionBusy(inv.id + "-paid");
    try {
      const r = await fetch(browserApiUrl(`/api/v1/invoices/${inv.id}/mark-paid`), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_reference: markPaidRef || undefined }),
      });
      if (r.ok) { const d = await r.json() as Invoice; setSelected(d); setMarkPaidRef(""); await load(); }
    } finally { setActionBusy(null); }
  }

  async function handleVoid(inv: Invoice) {
    if (!confirm(`Void invoice ${inv.invoice_number ?? inv.id}?`)) return;
    setActionBusy(inv.id + "-void");
    try {
      const r = await fetch(browserApiUrl(`/api/v1/invoices/${inv.id}/void`), {
        method: "POST", credentials: "include",
      });
      if (r.ok) { const d = await r.json() as Invoice; setSelected(d); await load(); }
    } finally { setActionBusy(null); }
  }

  const card: React.CSSProperties = { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 20, marginBottom: 16 };
  const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--input-bg, var(--card-bg))", color: "var(--ink)", fontSize: "0.88rem", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginBottom: 4, display: "block", textTransform: "uppercase" as const, letterSpacing: "0.05em" };

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total_gbp, 0);
  const totalOutstanding = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.total_gbp, 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Client Invoices</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>
            Issue invoices and collect payment via Stripe
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}
        >
          + New Invoice
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total invoices", value: String(invoices.length) },
          { label: "Paid", value: `£${totalPaid.toFixed(2)}`, color: "#22c55e" },
          { label: "Outstanding", value: `£${totalOutstanding.toFixed(2)}`, color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: color ?? "var(--ink)" }}>{value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "draft", "sent", "paid", "overdue", "void"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "1px solid var(--card-border)",
              background: filter === f ? "var(--brand)" : "transparent",
              color: filter === f ? "#fff" : "var(--ink)",
              fontWeight: 600, cursor: "pointer", fontSize: "0.8rem", textTransform: "capitalize",
            }}
          >{f}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Loading…</div>
      ) : invoices.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "var(--muted)", padding: 40 }}>No invoices found.</div>
      ) : invoices.map((inv) => (
        <div key={inv.id} style={{ ...card, cursor: "pointer" }} onClick={() => setSelected(inv)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--ink)" }}>{inv.client_name}</span>
                {statusBadge(inv.status)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                {inv.description}
                {inv.stripe_payment_link && " · Stripe link active"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--ink)" }}>£{inv.total_gbp.toFixed(2)}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{inv.invoice_number ?? inv.id}</div>
              {inv.due_date && inv.status !== "paid" && (
                <div style={{ fontSize: "0.72rem", color: new Date(inv.due_date) < new Date() ? "#ef4444" : "var(--muted)" }}>
                  Due {new Date(inv.due_date).toLocaleDateString("en-GB")}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* New invoice modal */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowNew(false)}>
          <div style={{ background: "var(--card-bg)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800 }}>New Invoice</h2>
            <form onSubmit={(e) => { void handleCreate(e); }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Client Name *</label>
                  <input required value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Client Email *</label>
                  <input type="email" required value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Amount (£) *</label>
                  <input type="number" min="0.01" step="0.01" required value={form.amount_gbp} onChange={(e) => setForm((f) => ({ ...f, amount_gbp: e.target.value }))} style={inp} placeholder="e.g. 850.00" />
                </div>
                <div>
                  <label style={lbl}>VAT Rate</label>
                  <select value={form.vat_rate} onChange={(e) => setForm((f) => ({ ...f, vat_rate: e.target.value }))} style={inp}>
                    <option value="0">0% (exempt)</option>
                    <option value="0.20">20% (standard)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Payment due (days)</label>
                  <input type="number" min="1" value={form.due_days} onChange={(e) => setForm((f) => ({ ...f, due_days: e.target.value }))} style={inp} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Description *</label>
                  <input required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={inp} placeholder="e.g. Adult ADHD Assessment — Initial consultation" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Notes</label>
                  <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...inp, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowNew(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--card-border)", background: "transparent", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  {saving ? "Creating…" : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setSelected(null)}>
          <div style={{ background: "var(--card-bg)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>{selected.invoice_number ?? selected.id}</h2>
                <div style={{ marginTop: 6 }}>{statusBadge(selected.status)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--muted)" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                ["Client", selected.client_name],
                ["Email", selected.client_email],
                ["Amount", `£${selected.amount_gbp.toFixed(2)}`],
                ["VAT", selected.vat_rate ? `${(selected.vat_rate * 100).toFixed(0)}%` : "Exempt"],
                ["Total", `£${selected.total_gbp.toFixed(2)}`],
                ["Due", selected.due_date ? new Date(selected.due_date).toLocaleDateString("en-GB") : "—"],
                ["Sent", selected.sent_at ? new Date(selected.sent_at).toLocaleDateString("en-GB") : "—"],
                ["Paid", selected.paid_at ? new Date(selected.paid_at).toLocaleDateString("en-GB") : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>{k}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{selected.description}</div>
            </div>

            {selected.stripe_payment_link && (
              <div style={{ marginBottom: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 10, wordBreak: "break-all" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>STRIPE PAYMENT LINK</div>
                <a href={selected.stripe_payment_link} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "#166534" }}>
                  {selected.stripe_payment_link}
                </a>
              </div>
            )}

            {selected.notes && (
              <div style={{ marginBottom: 14, fontSize: "0.82rem", color: "var(--muted)" }}>{selected.notes}</div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {selected.status === "draft" && (
                <button
                  onClick={() => { void handleSend(selected); }}
                  disabled={actionBusy !== null}
                  style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {actionBusy === selected.id + "-send" ? "Sending…" : "📧 Send to Client" + (process.env.NEXT_PUBLIC_STRIPE_ENABLED ? " + Generate Stripe Link" : "")}
                </button>
              )}

              {selected.status === "sent" && (
                <>
                  <div>
                    <label style={lbl}>Payment reference (optional)</label>
                    <input value={markPaidRef} onChange={(e) => setMarkPaidRef(e.target.value)} style={inp} placeholder="Bank ref or Stripe ID" />
                  </div>
                  <button
                    onClick={() => { void handleMarkPaid(selected); }}
                    disabled={actionBusy !== null}
                    style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                  >
                    {actionBusy === selected.id + "-paid" ? "Saving…" : "✓ Mark as Paid"}
                  </button>
                </>
              )}

              {selected.status !== "paid" && selected.status !== "void" && (
                <button
                  onClick={() => { void handleVoid(selected); }}
                  disabled={actionBusy !== null}
                  style={{ padding: "9px 0", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 700, cursor: "pointer" }}
                >
                  Void Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
