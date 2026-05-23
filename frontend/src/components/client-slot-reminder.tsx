"use client";

import { useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";

export function ClientSlotReminderButton({
  clientId,
  status,
  hasConfirmedSession,
}: {
  clientId: string;
  status: string;
  hasConfirmedSession: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (hasConfirmedSession || status !== "Forms Returned, Ready to Schedule") {
    return null;
  }

  async function send() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/reminders/slot-selection`), {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) {
        const d = j.detail;
        const text = typeof d === "string" ? d : "Could not send reminder";
        throw new Error(text);
      }
      setMsg("Slot-selection email sent (or queued).");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="mini-card" style={{ marginTop: "1rem" }}>
      <h3>Client reminders</h3>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
        Resend the personalised booking link email so the client can choose an assessment time from confirmed clinician
        availability. Intake forms also receive an automatic reminder email from the platform after several days if still
        outstanding (scheduled daily).
      </p>
      {err ? (
        <p className="inline-badge status-warn" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="inline-badge status-good" style={{ marginBottom: 8 }}>
          {msg}
        </p>
      ) : null}
      <button type="button" className="secondary-action button-reset" disabled={busy} onClick={() => void send()}>
        {busy ? "Sending…" : "Resend slot-selection email"}
      </button>
    </article>
  );
}
