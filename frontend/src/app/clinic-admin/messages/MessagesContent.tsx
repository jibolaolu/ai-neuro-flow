"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string;
  recipient_name: string;
  subject: string | null;
  body: string;
  parent_id: string | null;
  is_read: boolean;
  created_at: string | null;
};

type MsgList = { items: Msg[]; total: number; unread: number };
type User = { id: string; full_name: string; role: string };

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function MessagesContent() {
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [selected, setSelected] = useState<Msg | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/api/v1/messages/${tab}`, { credentials: "include" });
    const j: MsgList = await r.json().catch(() => ({ items: [], total: 0, unread: 0 }));
    setMsgs(j.items ?? []);
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/v1/messages/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: User[]) => setUsers(j))
      .catch(() => {});
  }, []);

  async function send() {
    if (!composeTo || !composeBody.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/messages/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: composeTo, subject: composeSubject || null, body: composeBody }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowCompose(false);
      setComposeTo(""); setComposeSubject(""); setComposeBody("");
      setTab("sent");
      void load();
    } catch { setError("Failed to send message"); }
    finally { setSending(false); }
  }

  async function markRead(id: string) {
    await fetch(`${getApiBase()}/api/v1/messages/${id}/read`, { method: "PATCH", credentials: "include" });
    setMsgs((m) => m.map((msg) => msg.id === id ? { ...msg, is_read: true } : msg));
  }

  const unread = msgs.filter((m) => !m.is_read).length;

  return (
    <>
      <style>{`
        .msg-layout{display:grid;grid-template-columns:300px 1fr;gap:0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff;min-height:500px}
        .msg-sidebar{border-right:1px solid #e2e8f0;display:flex;flex-direction:column}
        .msg-sidebar-header{padding:14px 16px;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;align-items:center}
        .msg-tab-btn{padding:6px 12px;border-radius:7px;border:1.5px solid #e2e8f0;background:#fff;font-size:12px;font-weight:600;color:#374151;cursor:pointer;font-family:inherit;transition:all .15s}
        .msg-tab-btn.active{background:#1e40af;border-color:#1e40af;color:#fff}
        .msg-item{padding:12px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .12s}
        .msg-item:hover{background:#f8fafc}
        .msg-item.active{background:#eff6ff}
        .msg-item.unread .msg-item-name{font-weight:800}
        .msg-item-name{font-size:13px;color:#0f172a;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .msg-item-preview{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .msg-item-date{font-size:10px;color:#94a3b8;float:right;margin-top:-2px}
        .msg-detail{padding:24px;flex:1}
        .msg-compose{padding:16px}
        .msg-input{width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box}
        .msg-input:focus{border-color:#1e40af}
        .msg-textarea{min-height:120px;resize:vertical}
        .msg-send-btn{padding:9px 20px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s}
        .msg-send-btn:hover{background:#1d4ed8}
        .msg-send-btn:disabled{opacity:.5;cursor:not-allowed}
        .msg-compose-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
        .msg-compose-btn:hover{background:#1e40af;color:#fff}
        @media(max-width:640px){.msg-layout{grid-template-columns:1fr}}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ marginBottom: 12 }}>
        <button className="msg-compose-btn" onClick={() => setShowCompose(!showCompose)}>
          {showCompose ? "✕ Cancel" : "✉ New Message"}
        </button>
      </div>

      {showCompose && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>New Message</h3>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>To</label>
            <select className="msg-input" value={composeTo} onChange={(e) => setComposeTo(e.target.value)}>
              <option value="">Select recipient…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Subject (optional)</label>
            <input className="msg-input" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject…" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Message</label>
            <textarea className="msg-input msg-textarea" value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Type your message…" />
          </div>
          <button className="msg-send-btn" disabled={sending || !composeTo || !composeBody.trim()} onClick={send}>
            {sending ? "Sending…" : "Send Message"}
          </button>
        </div>
      )}

      <div className="msg-layout">
        <div className="msg-sidebar">
          <div className="msg-sidebar-header">
            <button className={`msg-tab-btn${tab === "inbox" ? " active" : ""}`} onClick={() => { setTab("inbox"); setSelected(null); }}>
              Inbox {unread > 0 && tab === "inbox" && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10, marginLeft: 4 }}>{unread}</span>}
            </button>
            <button className={`msg-tab-btn${tab === "sent" ? " active" : ""}`} onClick={() => { setTab("sent"); setSelected(null); }}>Sent</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {msgs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No messages</div>
            ) : msgs.map((m) => (
              <div
                key={m.id}
                className={`msg-item${selected?.id === m.id ? " active" : ""}${!m.is_read && tab === "inbox" ? " unread" : ""}`}
                onClick={() => { setSelected(m); if (!m.is_read && tab === "inbox") void markRead(m.id); }}
              >
                <div className="msg-item-name">
                  {tab === "inbox" ? m.sender_name : m.recipient_name}
                  <span className="msg-item-date">{fmtDate(m.created_at)}</span>
                </div>
                <div className="msg-item-preview">{m.subject ? `${m.subject}: ` : ""}{m.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="msg-detail">
          {selected ? (
            <>
              <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800 }}>{selected.subject || "(no subject)"}</h3>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                From <strong>{selected.sender_name}</strong> · {fmtDate(selected.created_at)}
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.body}</div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✉️</div>
              <p style={{ fontSize: 13, margin: 0 }}>Select a message to read</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
