"use client";

import { useCallback, useEffect, useState } from "react";

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  address_line: string | null;
  postcode: string | null;
  date_of_birth: string | null;
  preferred_assessment_type: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

export function ClinicianSettingsContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", address_line: "", postcode: "", preferred_assessment_type: "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/auth/me`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (j) {
        setProfile(j);
        setForm({ full_name: j.full_name ?? "", phone: j.phone ?? "", address_line: j.address_line ?? "", postcode: j.postcode ?? "", preferred_assessment_type: j.preferred_assessment_type ?? "" });
      }
    } catch { setError("Failed to load profile"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!profile) return;
    setSaving(true); setSuccess(false);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/users/${profile.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed");
      setSuccess(true); void load();
    } catch { setError("Failed to save profile"); }
    finally { setSaving(false); }
  }

  if (!profile) return <div style={{ color: "#94a3b8", fontSize: 13, padding: 32 }}>Loading…</div>;

  return (
    <>
      <style>{`
        .cs-section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:22px;margin-bottom:16px}
        .cs-label{font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px}
        .cs-input{border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 11px;font-size:13px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
        .cs-input:focus{border-color:#1e40af}
        .cs-input:disabled{background:#f8fafc;color:#94a3b8}
        .cs-save-btn{padding:9px 20px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .cs-save-btn:disabled{opacity:.5}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 10, color: "#15803d", fontSize: 13, marginBottom: 14 }}>Profile updated successfully.</div>}

      <div className="cs-section">
        <h3 style={{ margin: "0 0 16px", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>Personal details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="cs-label">Email address</label>
            <input className="cs-input" value={profile.email} disabled />
          </div>
          <div>
            <label className="cs-label">Full name</label>
            <input className="cs-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="cs-label">Phone</label>
            <input className="cs-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+44 7700 000000" />
          </div>
          <div>
            <label className="cs-label">Postcode</label>
            <input className="cs-input" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} placeholder="e.g. SW1A 1AA" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="cs-label">Address</label>
            <input className="cs-input" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} placeholder="Street address" />
          </div>
          <div>
            <label className="cs-label">Preferred assessment type</label>
            <select className="cs-input" value={form.preferred_assessment_type} onChange={(e) => setForm({ ...form, preferred_assessment_type: e.target.value })}>
              <option value="">— No preference —</option>
              <option value="adhd">ADHD</option>
              <option value="autism">Autism</option>
              <option value="combined">Combined</option>
            </select>
          </div>
        </div>
      </div>

      <button className="cs-save-btn" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </>
  );
}
