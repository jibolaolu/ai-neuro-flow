"use client";

import { useCallback, useEffect, useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";

type SlotItem = { id: string; date_iso: string; start_time: string; end_time: string; label: string };

type BookingContext =
  | {
      client_name: string;
      pathway: string;
      already_booked: true;
      confirmed_session_at: string;
      slots: SlotItem[];
    }
  | {
      client_name: string;
      pathway: string;
      already_booked: false;
      clinician_name: string;
      slots: SlotItem[];
    };

export function ClientSlotBooking({ token }: { token: string }) {
  const [ctx, setCtx] = useState<BookingContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/public/booking/${encodeURIComponent(token)}`));
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) {
        const msg =
          typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? "Could not load booking" : "Could not load booking";
        throw new Error(msg);
      }
      setCtx(j as BookingContext);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load booking");
      setCtx(null);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmSelection() {
    if (!picked || !ctx || ctx.already_booked) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/public/booking/${encodeURIComponent(token)}/select`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: picked }),
      });
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      if (!r.ok) {
        const msg = typeof j.detail === "string" ? j.detail : "Could not book this time";
        throw new Error(msg);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell compact-shell" style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
          Neuro Flow · Neuro Flow
        </span>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Book your assessment</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 8, lineHeight: 1.55 }}>
          Choose a time from your clinician&apos;s confirmed availability. If nothing appears, the clinic may still be
          finalising the diary - you can try again later or reply to your invitation email.
        </p>
      </header>

      {error ? (
        <p className="inline-badge status-warn" role="alert">
          {error}
        </p>
      ) : null}

      {!ctx && !error ? <p style={{ color: "var(--muted)" }}>Loading…</p> : null}

      {ctx ? (
        <article className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Your booking</span>
              <h2>{ctx.client_name}</h2>
            </div>
          </div>
          <p style={{ marginTop: 0, color: "var(--text-muted)" }}>
            Pathway: <strong>{ctx.pathway}</strong>
          </p>

          {ctx.already_booked ? (
            <p className="inline-badge status-good">
              You already have a time booked
              {ctx.confirmed_session_at ? ` (${new Date(ctx.confirmed_session_at).toLocaleString("en-GB")})` : ""}.
            </p>
          ) : (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                Clinician: <strong>{ctx.clinician_name}</strong>
              </p>
              {ctx.slots.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>
                  No open slots right now. Please check back once your clinician has confirmed their rota, or contact the
                  clinic.
                </p>
              ) : (
                <>
                  <div className="key-value-item" style={{ marginBottom: "1rem" }}>
                    <span>Available times</span>
                    <select
                      className="patient-table-input"
                      style={{ minHeight: 44, width: "100%", maxWidth: 420 }}
                      value={picked ?? ""}
                      onChange={(e) => setPicked(e.target.value || null)}
                      disabled={busy}
                    >
                      <option value="">Select a slot…</option>
                      {ctx.slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="primary-action button-reset" disabled={busy || !picked} onClick={() => void confirmSelection()}>
                    {busy ? "Confirming…" : "Confirm this time"}
                  </button>
                </>
              )}
            </>
          )}
        </article>
      ) : null}
    </main>
  );
}
