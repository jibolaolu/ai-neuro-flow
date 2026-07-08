"use client";

import { useEffect, useState } from "react";
import { browserApiUrl } from "../lib/get-api-base";

type ProgressStep = {
  key: string;
  label: string;
  status: "complete" | "active" | "pending";
  completed_at?: string | null;
  detail?: string;
};

type ProgressData = {
  client_name: string;
  pathway: string;
  steps: ProgressStep[];
  overall_percent: number;
};

async function fetchProgress(token: string): Promise<ProgressData | null> {
  try {
    const r = await fetch(browserApiUrl(`/api/v1/forms/progress/${token}`), { cache: "no-store" });
    if (!r.ok) return null;
    return r.json() as Promise<ProgressData>;
  } catch {
    return null;
  }
}

function stepColor(status: ProgressStep["status"]) {
  if (status === "complete") return { bg: "#dcfce7", border: "#16a34a", dot: "#16a34a", text: "#15803d" };
  if (status === "active")   return { bg: "#eff6ff", border: "var(--brand)", dot: "var(--brand)", text: "var(--brand)" };
  return { bg: "var(--muted-100)", border: "var(--muted-200)", dot: "var(--muted-200)", text: "var(--muted)" };
}

export function ClientProgressTracker({ formToken }: { formToken: string }) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchProgress(formToken).then((d) => { setData(d); setLoading(false); });
  }, [formToken]);

  if (loading) return null;
  if (!data) return null;

  return (
    <div style={{
      border: "1px solid var(--card-border)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(29,78,216,0.06), rgba(124,92,252,0.06))",
        borderBottom: "1px solid var(--card-border)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 2 }}>
            Your assessment progress
          </div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)" }}>
            {data.pathway}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 80,
            height: 8,
            background: "var(--muted-200)",
            borderRadius: 4,
            overflow: "hidden",
          }}>
            <div style={{
              width: `${data.overall_percent}%`,
              height: "100%",
              background: "var(--brand)",
              borderRadius: 4,
              transition: "width 0.7s ease",
            }} />
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--brand)" }}>
            {data.overall_percent}%
          </span>
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 0 }}>
        {data.steps.map((step, idx) => {
          const colors = stepColor(step.status);
          const isLast = idx === data.steps.length - 1;
          return (
            <div key={step.key} style={{ display: "flex", gap: 14, position: "relative" }}>
              {/* Timeline spine */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `2px solid ${colors.border}`,
                  background: colors.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: colors.dot,
                }}>
                  {step.status === "complete" ? "✓" : step.status === "active" ? "▶" : idx + 1}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2,
                    flex: 1,
                    minHeight: 20,
                    background: step.status === "complete" ? "#bbf7d0" : "var(--muted-200)",
                  }} />
                )}
              </div>

              {/* Step content */}
              <div style={{ paddingBottom: isLast ? 0 : 16, paddingTop: 0, flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "0.84rem",
                  fontWeight: step.status === "active" ? 700 : 600,
                  color: colors.text,
                  lineHeight: 1.3,
                  marginBottom: 2,
                }}>
                  {step.label}
                  {step.status === "active" && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      background: "var(--brand)",
                      color: "#fff",
                      borderRadius: 4,
                      padding: "1px 6px",
                    }}>
                      Current
                    </span>
                  )}
                </div>
                {step.completed_at && (
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    Completed {new Date(step.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}
                {step.detail && (
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{step.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
