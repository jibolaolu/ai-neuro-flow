"use client";

import { useState } from "react";
import { browserApiUrl } from "../lib/get-api-base";

type RoomData = {
  provider: string;
  room_url: string;
  embed_url: string;
  host_room_url?: string;
  client_name: string;
  note?: string;
};

export function TelehealthRoom({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(browserApiUrl("/api/v1/telehealth/room"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, duration_minutes: 90 }),
      });
      if (!r.ok) throw new Error("Failed to create video room");
      const d = await r.json() as RoomData;
      setRoom(d);
      setShowEmbed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const providerLabel = room?.provider === "whereby" ? "Whereby" : room?.provider === "jitsi_fallback" ? "Jitsi (fallback)" : "Video";

  return (
    <div style={{
      border: "1px solid var(--card-border)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))",
        borderBottom: "1px solid var(--card-border)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
            Telehealth Session
          </div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ink)" }}>
            {clientName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {room && (
            <>
              <a
                href={room.host_room_url ?? room.room_url}
                target="_blank"
                rel="noreferrer"
                style={{ padding: "7px 14px", borderRadius: 8, background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}
              >
                Open in new tab ↗
              </a>
              <button
                onClick={() => setShowEmbed(e => !e)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--card-border)", background: "transparent", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", color: "var(--ink)" }}
              >
                {showEmbed ? "Hide embed" : "Show embed"}
              </button>
            </>
          )}
          {!room && (
            <button
              onClick={() => { void startSession(); }}
              disabled={loading}
              style={{ padding: "8px 18px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
            >
              {loading ? "Creating room…" : "📹 Start Video Session"}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fef2f2", color: "#dc2626", fontSize: "0.82rem" }}>{error}</div>
      )}

      {/* Room info */}
      {room && !showEmbed && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 4 }}>
            Provider: <strong>{providerLabel}</strong>
            {room.note && <span style={{ color: "#f59e0b", marginLeft: 8 }}>⚠ {room.note}</span>}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--ink)", wordBreak: "break-all" }}>
            Room: <a href={room.room_url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{room.room_url}</a>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>
            Share the room URL above with the patient. Click "Open in new tab" to join as host.
          </div>
        </div>
      )}

      {/* Embedded video */}
      {room && showEmbed && (
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#0f172a" }}>
          <iframe
            src={room.embed_url}
            allow="camera; microphone; fullscreen; speaker; display-capture"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title={`Video session with ${clientName}`}
          />
        </div>
      )}
    </div>
  );
}
