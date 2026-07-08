"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";
import { VoiceNoteButton } from "./voice-note-button";

export type CaseNoteRow = {
  id: string;
  author_name: string;
  body: string;
  created_at: string | null;
};

type SafeguardFlag = { category: string; match: string; excerpt: string };

export function ClientCaseNotesPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<CaseNoteRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [safeguardFlags, setSafeguardFlags] = useState<SafeguardFlag[]>([]);
  const [safeguardSeverity, setSafeguardSeverity] = useState<"none"|"low"|"medium"|"high">("none");
  const sgDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/case-notes`), {
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { items?: CaseNoteRow[]; detail?: unknown };
      if (!r.ok) {
        const d = j.detail;
        throw new Error(typeof d === "string" ? d : "Could not load notes");
      }
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load notes");
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleBodyChange(text: string) {
    setBody(text);
    if (sgDebounce.current) clearTimeout(sgDebounce.current);
    if (text.length < 20) { setSafeguardFlags([]); setSafeguardSeverity("none"); return; }
    sgDebounce.current = setTimeout(async () => {
      try {
        const r = await fetch(browserApiUrl("/api/v1/ai/safeguarding-check"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (r.ok) {
          const d = await r.json() as { severity: "none"|"low"|"medium"|"high"; flags: SafeguardFlag[] };
          setSafeguardFlags(d.flags);
          setSafeguardSeverity(d.severity);
        }
      } catch { /* silent */ }
    }, 1200);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/case-notes`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) {
        const d = j.detail;
        throw new Error(typeof d === "string" ? d : "Could not save note");
      }
      setBody("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mini-card" style={{ marginTop: 0 }}>
      <h3>Case notes</h3>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
        Shared dated log for clinical admin and assigned clinicians. Entries are stored with author and timestamp.
      </p>
      {err ? (
        <p className="inline-badge status-warn" role="alert" style={{ marginBottom: "0.75rem" }}>
          {err}
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} style={{ marginBottom: "1.25rem" }}>
        <label className="key-value-item" style={{ display: "block", marginBottom: 8 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>New note</span>
            <VoiceNoteButton
              disabled={busy}
              onTranscript={(t) => setBody((prev) => prev ? `${prev} ${t}` : t)}
            />
          </span>
          <textarea
            className="patient-table-textarea"
            style={{ minHeight: 100, width: "100%", marginTop: 6, borderColor: safeguardSeverity === "high" ? "#ef4444" : safeguardSeverity === "medium" ? "#f59e0b" : undefined }}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="Record contact, clinical update, or handoff… or click Dictate to speak"
            disabled={busy}
          />
        </label>
        {/* Safeguarding alert banner */}
        {safeguardSeverity !== "none" && safeguardFlags.length > 0 && (
          <div style={{
            marginTop: 8,
            marginBottom: 4,
            padding: "10px 14px",
            borderRadius: 8,
            background: safeguardSeverity === "high" ? "#fef2f2" : safeguardSeverity === "medium" ? "#fffbeb" : "#f8fafc",
            border: `1px solid ${safeguardSeverity === "high" ? "#fca5a5" : safeguardSeverity === "medium" ? "#fcd34d" : "#e2e8f0"}`,
          }}>
            <div style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              textTransform: "uppercase" as const,
              letterSpacing: "0.07em",
              color: safeguardSeverity === "high" ? "#dc2626" : safeguardSeverity === "medium" ? "#d97706" : "#64748b",
              marginBottom: 4,
            }}>
              ⚠ Safeguarding indicator detected — {safeguardSeverity} priority
            </div>
            {safeguardFlags.slice(0, 3).map((f, i) => (
              <div key={i} style={{ fontSize: "0.75rem", color: "#475569", marginBottom: 2 }}>
                <strong style={{ textTransform: "capitalize" as const }}>{f.category.replace("-", " ")}</strong>: {f.excerpt}
              </div>
            ))}
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>
              Please follow your safeguarding protocol and consult your designated safeguarding lead if appropriate.
            </div>
          </div>
        )}
        <button type="submit" className="primary-action button-reset" disabled={busy || !body.trim()}>
          {busy ? "Saving…" : "Save note"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No notes yet.</p>
        ) : (
          items.map((n) => (
            <article
              key={n.id}
              style={{
                border: "1px solid var(--card-border)",
                borderRadius: 8,
                padding: "12px 14px",
                background: "var(--surface-50, rgba(0,0,0,0.02))",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                <strong style={{ color: "var(--ink)" }}>{n.author_name}</strong>
                {n.created_at ? (
                  <>
                    {" "}
                    · {new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </>
                ) : null}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{n.body}</div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
