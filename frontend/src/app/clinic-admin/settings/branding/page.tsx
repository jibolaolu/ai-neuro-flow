"use client";

import { useEffect, useState } from "react";
import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";
import { browserApiUrl } from "../../../../lib/get-api-base";

const label: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6,
};
const input: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1px solid var(--card-border)",
  borderRadius: "var(--radius-sm)", fontSize: 15, boxSizing: "border-box",
  background: "#fff", color: "var(--ink)",
};
const card: React.CSSProperties = {
  background: "var(--card-bg)", borderRadius: "var(--radius-lg)",
  padding: "24px 28px", border: "1px solid var(--card-border)",
  boxShadow: "var(--shadow-sm)", marginBottom: 20,
};

type OrgBranding = {
  display_name: string;
  support_email: string;
  contact_phone: string;
  address: string;
  website: string;
  logo_url: string;
  registered_company_number: string;
  cqc_registration_number: string;
  ico_registration_number: string;
};

export default function ClinicBrandingPage() {
  const [form, setForm] = useState<OrgBranding>({
    display_name: "", support_email: "", contact_phone: "",
    address: "", website: "", logo_url: "",
    registered_company_number: "", cqc_registration_number: "", ico_registration_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(browserApiUrl("/api/v1/organizations/me"), { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setForm({
          display_name: d.display_name ?? "",
          support_email: d.support_email ?? "",
          contact_phone: d.contact_phone ?? "",
          address: d.address ?? "",
          website: d.website ?? "",
          logo_url: d.logo_url ?? "",
          registered_company_number: d.registered_company_number ?? "",
          cqc_registration_number: d.cqc_registration_number ?? "",
          ico_registration_number: d.ico_registration_number ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(k: keyof OrgBranding, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(browserApiUrl("/api/v1/organizations/me"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const nav = getClinicAdminNav("/clinic-admin/settings/branding");

  return (
    <RoleDashboardShell nav={nav} role="clinical-admin" pageTitle="Clinic Branding">
      {loading ? (
        <p style={{ color: "var(--muted)", padding: 24 }}>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: 680 }}>
          <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
            These details appear on client-facing reports, forms, emails, and invoices.
            They override the platform defaults for your clinic.
          </p>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: "var(--ink)" }}>
              Display &amp; Contact
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Clinic display name *</label>
                <input style={input} value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  placeholder="e.g. Harley Street Mind Clinic" />
                <small style={{ color: "var(--muted)", fontSize: 12 }}>
                  Shown on all client documents — forms, reports, emails.
                </small>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Support / contact email</label>
                <input style={input} type="email" value={form.support_email}
                  onChange={(e) => set("support_email", e.target.value)}
                  placeholder="support@yourclinic.co.uk" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Contact phone</label>
                <input style={input} value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                  placeholder="020 1234 5678" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Website</label>
                <input style={input} value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://yourclinic.co.uk" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Address (appears on invoices &amp; letters)</label>
              <textarea style={{ ...input, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="123 High Street&#10;London&#10;W1A 1AA" />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={label}>Logo URL (optional)</label>
              <input style={input} value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://cdn.yourclinic.co.uk/logo.png" />
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: "var(--ink)" }}>
              UK Regulatory Identifiers
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              These appear in report footers and formal correspondence. Leave blank if not applicable.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Companies House number</label>
                <input style={input} value={form.registered_company_number}
                  onChange={(e) => set("registered_company_number", e.target.value)}
                  placeholder="12345678" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>CQC registration number</label>
                <input style={input} value={form.cqc_registration_number}
                  onChange={(e) => set("cqc_registration_number", e.target.value)}
                  placeholder="1-12345678" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>ICO registration number</label>
                <input style={input} value={form.ico_registration_number}
                  onChange={(e) => set("ico_registration_number", e.target.value)}
                  placeholder="ZA123456" />
              </div>
            </div>
          </div>

          {error && (
            <p style={{ color: "var(--danger)", background: "var(--danger-50)", border: "1px solid var(--danger-100)",
              borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 14, marginBottom: 16 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button type="submit" disabled={saving}
              style={{ background: "var(--brand)", color: "#fff", border: "none",
                borderRadius: "var(--radius-sm)", padding: "12px 28px", fontSize: 15,
                fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && <span style={{ color: "var(--teal)", fontWeight: 700, fontSize: 14 }}>✓ Saved</span>}
          </div>
        </form>
      )}
    </RoleDashboardShell>
  );
}
