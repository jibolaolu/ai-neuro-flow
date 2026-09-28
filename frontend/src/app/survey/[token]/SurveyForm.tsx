"use client";

import { useCallback, useEffect, useState } from "react";

type SurveyData = {
  client_id: string;
  submitted_at: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

const NPS_LABELS: Record<number, string> = {
  0: "Very unlikely", 1: "Unlikely", 2: "Unlikely", 3: "Unlikely", 4: "Somewhat unlikely",
  5: "Neutral", 6: "Somewhat likely", 7: "Likely", 8: "Likely", 9: "Very likely", 10: "Extremely likely",
};

export function SurveyForm({ token }: { token: string }) {
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ nps_score: -1, satisfaction_score: 0, communication_score: 0, report_quality_score: 0, free_text: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/surveys/public/${token}`);
      if (r.status === 404) { setNotFound(true); return; }
      const j = await r.json().catch(() => null);
      if (j?.submitted_at) { setSubmitted(true); }
      setSurvey(j);
    } catch { setNotFound(true); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (form.nps_score < 0 || form.satisfaction_score === 0) return;
    setSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/surveys/public/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed");
      setSubmitted(true);
    } catch { setError("Failed to submit. Please try again."); }
    finally { setSaving(false); }
  }

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <h2 style={{ margin: "0 0 8px", color: "#0f172a" }}>Survey not found</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>This survey link is invalid or has expired.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ margin: "0 0 8px", color: "#0f172a" }}>Thank you!</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>Your feedback has been received. We really appreciate you taking the time to share your experience.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 16px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "#1e40af", borderRadius: 16, padding: "24px 28px", marginBottom: 24, color: "#fff" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 800 }}>How was your experience?</h1>
          <p style={{ margin: 0, opacity: .8, fontSize: 14 }}>Your feedback helps us improve our service. This takes about 2 minutes.</p>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ background: "#fff", borderRadius: 16, padding: 28, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>
            How likely are you to recommend us to a friend or family member?
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>0 = not at all likely, 10 = extremely likely</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} onClick={() => setForm({ ...form, nps_score: i })} style={{
                width: 44, height: 44, borderRadius: 8, border: form.nps_score === i ? "2.5px solid #1e40af" : "1.5px solid #e2e8f0",
                background: form.nps_score === i ? "#1e40af" : "#fff", color: form.nps_score === i ? "#fff" : "#374151",
                fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              }}>{i}</button>
            ))}
          </div>
          {form.nps_score >= 0 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>{NPS_LABELS[form.nps_score]}</div>}
        </div>

        {[
          { key: "satisfaction_score" as const, label: "Overall satisfaction", sub: "How satisfied were you with our service overall?" },
          { key: "communication_score" as const, label: "Communication", sub: "How well did we keep you informed throughout the process?" },
          { key: "report_quality_score" as const, label: "Report quality", sub: "How satisfied were you with the quality of your report?" },
        ].map(({ key, label, sub }) => (
          <div key={key} style={{ background: "#fff", borderRadius: 16, padding: 28, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{label}</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b" }}>{sub}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, [key]: n })} style={{
                  flex: 1, height: 44, borderRadius: 8, border: form[key] === n ? "2.5px solid #1e40af" : "1.5px solid #e2e8f0",
                  background: form[key] === n ? "#1e40af" : "#fff", color: form[key] === n ? "#fff" : "#374151",
                  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                }}>{"★".repeat(n)}</button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: "#fff", borderRadius: 16, padding: 28, marginBottom: 24, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>Any additional comments?</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>Optional — please share anything else you&apos;d like us to know.</p>
          <textarea value={form.free_text} onChange={(e) => setForm({ ...form, free_text: e.target.value })} style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 90, boxSizing: "border-box" }} placeholder="Share your thoughts…" />
        </div>

        <button disabled={saving || form.nps_score < 0 || form.satisfaction_score === 0} onClick={submit} style={{
          width: "100%", padding: "14px 0", background: form.nps_score >= 0 && form.satisfaction_score > 0 ? "#1e40af" : "#94a3b8",
          color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        }}>
          {saving ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}
