/**
 * Public referrer portal — GPs and CAMHS teams check referral status
 * without needing a Neuro Flow account.
 * URL: /referrer/RTC-XXXXXXXX
 */

import { serverApiUrl } from "../../../lib/get-api-base";

type ReferralStatus = {
  id: string;
  patient_name: string;
  pathway: string;
  status: string;
  priority: string;
  gp_name: string | null;
  gp_practice: string | null;
  referred_date: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  acceptance_letter_sent: boolean;
  converted_client_id: string | null;
};

const STATUS_MESSAGES: Record<string, { title: string; detail: string; color: string; bg: string }> = {
  pending: {
    title:  "Under review",
    detail: "The referral has been received and is being reviewed by our clinical team. You will be notified once a decision is made.",
    color:  "#d97706", bg: "#fffbeb",
  },
  accepted: {
    title:  "Accepted",
    detail: "We have accepted this referral. The patient will receive a booking invitation shortly. An acceptance letter has been sent.",
    color:  "#16a34a", bg: "#f0fdf4",
  },
  rejected: {
    title:  "Unable to accept",
    detail: "We are unable to accept this referral at this time. Please see the reason below.",
    color:  "#dc2626", bg: "#fef2f2",
  },
  converted: {
    title:  "Patient registered",
    detail: "This referral has been accepted and the patient has been registered in our system. Assessment scheduling is in progress.",
    color:  "#6366f1", bg: "#eef2ff",
  },
};

async function fetchReferral(referralId: string): Promise<ReferralStatus | null> {
  try {
    const r = await fetch(serverApiUrl(`/api/v1/referrals/${referralId}`), {
      cache: "no-store",
      headers: { "X-Internal-Referrer-Portal": "1" },
    });
    if (!r.ok) return null;
    return r.json() as Promise<ReferralStatus>;
  } catch {
    return null;
  }
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ReferrerPortalPage({ params }: { params: { token: string } }) {
  const referral = await fetchReferral(params.token);

  const brand: React.CSSProperties = {
    background: "linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)",
    padding: "20px 24px",
    color: "#fff",
  };

  if (!referral) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={brand}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem" }}>Neuro Flow</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>Referrer Portal</div>
        </div>
        <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>Referral not found</h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            The referral ID <strong>{params.token}</strong> was not found. Please check the ID and try again,
            or contact our team at <a href="mailto:referrals@neuroflow.health" style={{ color: "#1d4ed8" }}>referrals@neuroflow.health</a>.
          </p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MESSAGES[referral.status] ?? STATUS_MESSAGES.pending;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={brand}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem" }}>Neuro Flow</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>GP Referrer Portal</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        {/* Referral ID */}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>
          Referral ID
        </div>
        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>{referral.id}</div>

        {/* Status card */}
        <div style={{
          background: statusInfo.bg,
          border: `1px solid ${statusInfo.color}44`,
          borderRadius: 14,
          padding: "20px 22px",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%", background: statusInfo.color, flexShrink: 0,
            }} />
            <span style={{ fontWeight: 800, fontSize: "1rem", color: statusInfo.color }}>{statusInfo.title}</span>
          </div>
          <p style={{ color: "#475569", fontSize: "0.88rem", margin: 0, lineHeight: 1.6 }}>{statusInfo.detail}</p>
          {referral.rejection_reason && (
            <div style={{ marginTop: 12, background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #fca5a5" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#dc2626", marginBottom: 4 }}>Reason</div>
              <div style={{ fontSize: "0.85rem", color: "#7f1d1d" }}>{referral.rejection_reason}</div>
            </div>
          )}
        </div>

        {/* Patient & referral details */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 14px" }}>Referral details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              ["Patient", referral.patient_name],
              ["Pathway", referral.pathway],
              ["Priority", referral.priority],
              ["Referring GP", referral.gp_name ?? "—"],
              ["GP Practice", referral.gp_practice ?? "—"],
              ["Date referred", fmtDate(referral.referred_date)],
              ...(referral.accepted_at ? [["Date accepted", fmtDate(referral.accepted_at)]] : []),
              ...(referral.rejected_at ? [["Date decided", fmtDate(referral.rejected_at)]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: "0.88rem", color: "#0f172a", fontWeight: 600, textTransform: k === "Priority" ? "capitalize" : "none" as never }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 14px" }}>Timeline</h2>
          {[
            { label: "Referral received", date: referral.referred_date, done: true },
            { label: "Under clinical review", date: null, done: ["accepted","rejected","converted"].includes(referral.status) },
            { label: "Decision made", date: referral.accepted_at ?? referral.rejected_at, done: ["accepted","rejected","converted"].includes(referral.status) },
            { label: "Patient registered & scheduling", date: null, done: referral.status === "converted" },
          ].map(({ label, date, done }, i, arr) => (
            <div key={label} style={{ display: "flex", gap: 14, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: done ? "#22c55e" : "#e2e8f0",
                  border: `2px solid ${done ? "#16a34a" : "#cbd5e1"}`,
                  display: "grid", placeItems: "center", fontSize: "0.6rem", color: "#fff", fontWeight: 800,
                }}>{done ? "✓" : ""}</div>
                {i < arr.length - 1 && <div style={{ width: 2, height: 28, background: done ? "#bbf7d0" : "#e2e8f0" }} />}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: done ? "#0f172a" : "#94a3b8" }}>{label}</div>
                {date && <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{fmtDate(date)}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Contact footer */}
        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "8px 0 24px" }}>
          Questions? Contact us at{" "}
          <a href="mailto:referrals@neuroflow.health" style={{ color: "#1d4ed8" }}>referrals@neuroflow.health</a>
          {" "}or call your regional ICB liaison.
        </div>
      </div>
    </div>
  );
}
