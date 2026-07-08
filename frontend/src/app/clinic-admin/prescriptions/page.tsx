"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";
import { haptic } from "../../../lib/haptics";

type Prescription = {
  id: number;
  client_id: number;
  medication: string;
  formulation: string | null;
  dose_mg: number | null;
  frequency: string | null;
  status: string;
  titration_phase: number;
  titration_steps: Array<{ phase: number; dose_mg: number; duration_weeks: number; notes: string }>;
  start_date: string | null;
  review_date: string | null;
  shared_care_requested: boolean;
  shared_care_gp_name: string | null;
  side_effects: string | null;
  monitoring_notes: string | null;
};

type MedRef = { name: string; formulations: string[] };

const STATUS_COLOURS: Record<string, string> = {
  active: "#059669", "on-hold": "#d97706", stopped: "#dc2626", completed: "#64748b",
};

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medRefs, setMedRefs] = useState<MedRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSharedCare, setShowSharedCare] = useState(false);
  const [clientFilter, setClientFilter] = useState("");

  // Create form
  const [form, setForm] = useState({ client_id: "", medication: "", formulation: "", dose_mg: "", frequency: "once daily", indication: "", start_date: "" });
  const [scForm, setScForm] = useState({ gp_name: "", gp_email: "" });
  const [scLetter, setScLetter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Load across all clients — in prod would filter by client
    const [medsRes] = await Promise.all([
      fetch(browserApiUrl("/api/v1/prescriptions/medications"), { credentials: "include" }),
    ]);
    if (medsRes.ok) setMedRefs(await medsRes.json());
    setLoading(false);
    setPrescriptions([]); // populated when a client is selected
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function loadForClient(clientId: string) {
    if (!clientId) { setPrescriptions([]); return; }
    const r = await fetch(browserApiUrl(`/api/v1/prescriptions/client/${clientId}`), { credentials: "include" });
    if (r.ok) setPrescriptions(await r.json());
  }

  async function create() {
    setSaving(true);
    haptic("tap");
    const r = await fetch(browserApiUrl("/api/v1/prescriptions/"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(form.client_id),
        medication: form.medication,
        formulation: form.formulation || null,
        dose_mg: form.dose_mg ? Number(form.dose_mg) : null,
        frequency: form.frequency,
        indication: form.indication || null,
        start_date: form.start_date || null,
      }),
    });
    if (r.ok) {
      haptic("success");
      setShowCreate(false);
      await loadForClient(form.client_id);
    }
    setSaving(false);
  }

  async function titrate(rx: Prescription, dir: "up" | "down") {
    haptic("selection");
    const r = await fetch(browserApiUrl(`/api/v1/prescriptions/${rx.id}/titrate`), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: dir }),
    });
    if (r.ok) {
      const updated = await r.json();
      setPrescriptions(p => p.map(x => x.id === rx.id ? updated : x));
      setSelected(updated);
      haptic("success");
    }
  }

  async function requestSharedCare() {
    if (!selected) return;
    setSaving(true);
    const r = await fetch(browserApiUrl(`/api/v1/prescriptions/${selected.id}/shared-care`), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scForm),
    });
    if (r.ok) {
      const data = await r.json();
      setScLetter(data.letter);
      haptic("success");
    }
    setSaving(false);
  }

  const selectedMedRef = medRefs.find(m => m.name === form.medication);

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Prescribing & Titration</h2>
          <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Medication management, dose titration, and shared-care letters</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: "8px 16px", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
          + New Prescription
        </button>
      </div>

      {/* Client filter */}
      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Enter client ID to view prescriptions…"
          value={clientFilter}
          onChange={e => { setClientFilter(e.target.value); void loadForClient(e.target.value); }}
          style={{ width: 260, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }}
        />
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: "0.84rem" }}>Loading…</p>
      ) : prescriptions.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>💊</div>
          <p style={{ fontSize: "0.84rem" }}>Enter a client ID above to view their prescriptions</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16 }}>
          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prescriptions.map(rx => (
              <div
                key={rx.id}
                onClick={() => setSelected(rx)}
                style={{ background: "#fff", border: `2px solid ${selected?.id === rx.id ? "#1d4ed8" : "#e2e8f0"}`, borderRadius: 12, padding: 14, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                  <strong style={{ fontSize: "0.88rem" }}>💊 {rx.medication}</strong>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: STATUS_COLOURS[rx.status] + "20", color: STATUS_COLOURS[rx.status] }}>
                    {rx.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {rx.dose_mg && <span>💉 {rx.dose_mg}mg</span>}
                  {rx.frequency && <span>🕐 {rx.frequency}</span>}
                  <span>Phase {rx.titration_phase}/{rx.titration_steps.length || "?"}</span>
                  {rx.review_date && <span>📅 Review {rx.review_date}</span>}
                </div>
                {rx.shared_care_requested && (
                  <div style={{ marginTop: 6, fontSize: "0.68rem", color: "#059669", fontWeight: 600 }}>
                    ✓ Shared care sent to {rx.shared_care_gp_name}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <strong style={{ fontSize: "0.9rem" }}>💊 {selected.medication}</strong>
                <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1rem" }}>✕</button>
              </div>

              {/* Titration progress */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>Titration Progress</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                  {selected.titration_steps.map(step => (
                    <div key={step.phase} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 600,
                      background: step.phase <= selected.titration_phase ? "#dbeafe" : "#f1f5f9",
                      color: step.phase <= selected.titration_phase ? "#1d4ed8" : "#94a3b8",
                      border: step.phase === selected.titration_phase ? "2px solid #1d4ed8" : "1px solid transparent",
                    }}>
                      Ph{step.phase}: {step.dose_mg}mg
                    </div>
                  ))}
                </div>
                {selected.titration_steps.length > 0 && (
                  <div style={{ fontSize: "0.72rem", color: "#64748b", background: "#f8fafc", padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}>
                    {selected.titration_steps.find(s => s.phase === selected.titration_phase)?.notes}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => titrate(selected, "down")}
                    disabled={selected.titration_phase <= 1}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
                  >
                    ↓ Step Down
                  </button>
                  <button
                    onClick={() => titrate(selected, "up")}
                    disabled={selected.titration_phase >= selected.titration_steps.length}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}
                  >
                    ↑ Step Up
                  </button>
                </div>
              </div>

              {/* Monitoring */}
              {selected.side_effects && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: "0.75rem" }}>
                  <strong>Side effects:</strong> {selected.side_effects}
                </div>
              )}

              {/* Shared care */}
              <button
                onClick={() => setShowSharedCare(true)}
                style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "1.5px solid #059669", color: "#059669", background: "#ecfdf5", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem" }}
              >
                📋 Generate Shared-Care Letter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <strong>New Prescription</strong>
              <button onClick={() => setShowCreate(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            {[
              { label: "Client ID", key: "client_id", type: "number" },
              { label: "Indication", key: "indication", type: "text" },
              { label: "Dose (mg)", key: "dose_mg", type: "number" },
              { label: "Frequency", key: "frequency", type: "text" },
              { label: "Start Date", key: "start_date", type: "date" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>Medication</label>
              <select value={form.medication} onChange={e => setForm(p => ({ ...p, medication: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }}>
                <option value="">Select medication…</option>
                {medRefs.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                <option value="other">Other / custom</option>
              </select>
            </div>
            {selectedMedRef && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>Formulation</label>
                <select value={form.formulation} onChange={e => setForm(p => ({ ...p, formulation: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }}>
                  {selectedMedRef.formulations.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => { void create(); }} disabled={saving || !form.client_id || !form.medication}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
              {saving ? "Saving…" : "Create Prescription"}
            </button>
          </div>
        </div>
      )}

      {/* Shared-care modal */}
      {showSharedCare && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <strong>Shared-Care Letter — {selected.medication}</strong>
              <button onClick={() => { setShowSharedCare(false); setScLetter(null); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            {!scLetter ? (
              <>
                {[{ label: "GP Name", key: "gp_name" }, { label: "GP Email", key: "gp_email" }].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input value={(scForm as any)[f.key]} onChange={e => setScForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }} />
                  </div>
                ))}
                <button onClick={() => { void requestSharedCare(); }} disabled={saving || !scForm.gp_name || !scForm.gp_email}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "#059669", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Generating…" : "Generate & Send Letter"}
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "pre-wrap", marginBottom: 12 }}>
                  {scLetter}
                </div>
                <button onClick={() => { window.print(); }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #1d4ed8", color: "#1d4ed8", background: "#eff6ff", fontWeight: 700, cursor: "pointer" }}>
                  🖨 Print / Save PDF
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
