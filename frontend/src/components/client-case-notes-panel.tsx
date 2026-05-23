"use client";

import { useCallback, useEffect, useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";

export type CaseNoteRow = {
  id: string;
  author_name: string;
  body: string;
  created_at: string | null;
};

export function ClientCaseNotesPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<CaseNoteRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          <span>New note</span>
          <textarea
            className="patient-table-textarea"
            style={{ minHeight: 100, width: "100%", marginTop: 6 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Record contact, clinical update, or handoff…"
            disabled={busy}
          />
        </label>
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
