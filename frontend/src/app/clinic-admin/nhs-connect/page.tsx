"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApiUrl } from "../../../lib/get-api-base";
import { haptic } from "../../../lib/haptics";

type OdsResult = { ods_code: string; name: string; status: string; address?: Record<string, string>; roles?: string[] };
type IntegrationStatus = { ods_lookup: string; emis_webhook: string; emis_oauth: string; gp_connect: string; nhs_spine: string; readiness_score: number; next_steps: string[] };

const STATUS_ICON: Record<string, string> = { live: "🟢", configured: "🟢", planned: "🟡", unconfigured: "🟠", pending: "🟠" };

export default function NhsConnectPage() {
  const [tab, setTab] = useState<"status" | "ods" | "webhook">("status");
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [odsQuery, setOdsQuery] = useState("");
  const [odsResults, setOdsResults] = useState<OdsResult[]>([]);
  const [odsDetail, setOdsDetail] = useState<OdsResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch(browserApiUrl("/api/v1/nhs/status"), { credentials: "include" });
    if (r.ok) setStatus(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function searchOds() {
    if (!odsQuery.trim()) return;
    setSearching(true); haptic("tap");
    const r = await fetch(browserApiUrl(`/api/v1/nhs/ods/search/${encodeURIComponent(odsQuery)}`), { credentials: "include" });
    if (r.ok) setOdsResults(await r.json());
    setSearching(false);
  }

  async function lookupOds(code: string) {
    haptic("tap");
    const r = await fetch(browserApiUrl(`/api/v1/nhs/ods/${code}`), { credentials: "include" });
    if (r.ok) setOdsDetail(await r.json());
  }

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>NHS / EMIS Connect</h2>
        <p style={{ fontSize: "0.75rem", color: "#64748b" }}>ODS lookup · EMIS webhook receiver · GP Connect readiness</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {([["status", "🏥 Integration Status"], ["ods", "🔍 ODS Lookup"], ["webhook", "🔗 Webhook Config"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
              background: tab === t ? "#1d4ed8" : "#f1f5f9", color: tab === t ? "#fff" : "#64748b" }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: "#94a3b8" }}>Loading…</p> : (
        <>
          {/* ── STATUS ── */}
          {tab === "status" && status && (
            <div>
              {/* Readiness score */}
              <div style={{ background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", borderRadius: 14, padding: 20, color: "#fff", marginBottom: 16 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", opacity: .8, marginBottom: 8 }}>NHS Integration Readiness</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, lineHeight: 1 }}>{status.readiness_score}</span>
                  <span style={{ opacity: .7, marginBottom: 4 }}>/10</span>
                </div>
                <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 999, height: 8, marginBottom: 14 }}>
                  <div style={{ height: 8, borderRadius: 999, background: "#fff", width: `${status.readiness_score * 10}%` }} />
                </div>
              </div>

              {/* Integration items */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  ["ODS Lookup", status.ods_lookup],
                  ["EMIS Webhook", status.emis_webhook],
                  ["EMIS OAuth", status.emis_oauth],
                  ["GP Connect", status.gp_connect],
                  ["NHS Spine", status.nhs_spine],
                  ["SystmOne", "planned"],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.1rem" }}>{STATUS_ICON[val] || "⚪"}</span>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: "0.68rem", textTransform: "capitalize", color: "#64748b" }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Next steps */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>Next Steps to Full Integration</div>
                {status.next_steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: "0.8rem", alignItems: "start" }}>
                    <span style={{ color: "#1d4ed8", fontWeight: 700, flexShrink: 0 }}>→</span>
                    {step}
                  </div>
                ))}
                <a href="https://digital.nhs.uk/services/gp-connect" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 10, fontSize: "0.75rem", color: "#1d4ed8", fontWeight: 600 }}>
                  NHS Digital GP Connect documentation ↗
                </a>
              </div>
            </div>
          )}

          {/* ── ODS LOOKUP ── */}
          {tab === "ods" && (
            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Search NHS ODS (live NHS API)</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={odsQuery} onChange={e => setOdsQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && void searchOds()}
                    placeholder="Organisation name or ODS code…"
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: "0.84rem" }} />
                  <button onClick={() => { void searchOds(); }} disabled={searching}
                    style={{ padding: "9px 18px", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                    {searching ? "…" : "Search"}
                  </button>
                </div>
              </div>

              {odsDetail && (
                <div style={{ background: "#eff6ff", border: "1.5px solid #1d4ed8", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{odsDetail.name}</strong>
                    <button onClick={() => setOdsDetail(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: "0.78rem" }}>
                    <div><span style={{ color: "#64748b" }}>ODS Code: </span><strong>{odsDetail.ods_code}</strong></div>
                    <div><span style={{ color: "#64748b" }}>Status: </span><strong>{odsDetail.status}</strong></div>
                    {odsDetail.address && Object.entries(odsDetail.address).slice(0, 4).map(([k, v]) => (
                      <div key={k}><span style={{ color: "#64748b" }}>{k}: </span>{v as string}</div>
                    ))}
                  </div>
                </div>
              )}

              {odsResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {odsResults.map(org => (
                    <div key={org.ods_code} onClick={() => { void lookupOds(org.ods_code); }}
                      style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{org.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{org.type}</div>
                      </div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", padding: "3px 9px", borderRadius: 6 }}>{org.ods_code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── WEBHOOK CONFIG ── */}
          {tab === "webhook" && (
            <div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>EMIS Webhook Endpoint</div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: "0.82rem", marginBottom: 12, wordBreak: "break-all" }}>
                  POST /api/v1/nhs/webhook/emis
                </div>
                <p style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.6, marginBottom: 12 }}>
                  Register this URL in your EMIS Web NHS integration settings. EMIS will POST patient referral data here when a GP selects NeuroFlow as the Right-to-Choose provider.
                </p>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: "0.75rem" }}>
                  <strong>Security:</strong> Set <code>EMIS_WEBHOOK_SECRET</code> in your environment to enable HMAC-SHA256 signature verification.
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Environment Variables Required</div>
                {[
                  { key: "EMIS_CLIENT_ID", desc: "EMIS API client ID (from EMIS partnership agreement)" },
                  { key: "EMIS_CLIENT_SECRET", desc: "EMIS API client secret" },
                  { key: "EMIS_WEBHOOK_SECRET", desc: "HMAC secret for webhook signature verification" },
                  { key: "NHS_SPINE_URL", desc: "NHS Spine endpoint (requires NHS Digital approval)" },
                ].map(item => (
                  <div key={item.key} style={{ marginBottom: 10 }}>
                    <code style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1d4ed8" }}>{item.key}</code>
                    <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
