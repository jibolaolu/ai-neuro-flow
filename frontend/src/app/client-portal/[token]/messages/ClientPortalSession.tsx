"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PortalMessage = {
  id: string;
  direction: "client_to_clinic" | "clinic_to_client";
  sender_name: string | null;
  body: string;
  created_at: string | null;
};

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

export function ClientPortalSession({ token }: { token: string }) {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/public/client-comms/${token}/messages`);
      if (r.status === 404) { setError("This portal link is invalid or has expired."); return; }
      const j = await r.json().catch(() => ({ items: [] }));
      setMessages(j.items ?? []);
      setLoaded(true);
    } catch { setError("Failed to load messages"); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/public/client-comms/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), sender_name: senderName.trim() || "Client" }),
      });
      if (!r.ok) throw new Error("Failed");
      setBody(""); void load();
    } catch { setError("Failed to send message"); }
    finally { setSending(false); }
  }

  if (error && !loaded) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,.07)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
        <h2 style={{ margin: "0 0 8px", color: "#0f172a" }}>Link unavailable</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#1e40af", padding: "16px 20px", color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, background: "rgba(255,255,255,.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💬</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>Secure Client Portal</div>
          <div style={{ fontSize: 12, opacity: .8 }}>Your messages with the clinic team</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
        {messages.length === 0 && loaded && (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 14 }}>
            No messages yet. Send a message below to get started.
          </div>
        )}
        {messages.map((m) => {
          const isClient = m.direction === "client_to_clinic";
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isClient ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{
                maxWidth: "72%", background: isClient ? "#1e40af" : "#fff", color: isClient ? "#fff" : "#0f172a",
                borderRadius: isClient ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,.08)",
              }}>
                {!isClient && <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 3 }}>{m.sender_name ?? "Clinic"}</div>}
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.body}</div>
                {m.created_at && <div style={{ fontSize: 10, opacity: .6, marginTop: 4, textAlign: "right" }}>
                  {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ background: "#fff", borderTop: "1px solid #e2e8f0", padding: 16 }}>
        {error && loaded && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{error}</div>}
        {!senderName && (
          <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your name (optional)" style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Type a message…"
            style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none" }}
          />
          <button disabled={sending || !body.trim()} onClick={send} style={{
            padding: "0 18px", background: body.trim() ? "#1e40af" : "#94a3b8", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
