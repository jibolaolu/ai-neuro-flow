"use client";

import { useCallback, useEffect, useState } from "react";

type Post = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  visibility: string;
  pinned: boolean;
  image_urls: string[];
  created_at: string | null;
};

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

const VISIBILITY_LABELS: Record<string, string> = {
  all_staff: "All Staff",
  clinicians_only: "Clinicians Only",
  admin_only: "Admin Only",
};

export function NewsfeedContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newVis, setNewVis] = useState("all_staff");
  const [newPinned, setNewPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/v1/newsfeed/`, { credentials: "include" });
      const j = await r.json().catch(() => ({ items: [] }));
      setPosts(j.items ?? []);
    } catch { setError("Failed to load newsfeed"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createPost() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/newsfeed/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody, visibility: newVis, pinned: newPinned }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowNew(false); setNewTitle(""); setNewBody(""); setNewVis("all_staff"); setNewPinned(false);
      void load();
    } catch { setError("Failed to create post"); }
    finally { setSaving(false); }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    await fetch(`${getApiBase()}/api/v1/newsfeed/${id}`, { method: "DELETE", credentials: "include" });
    void load();
  }

  return (
    <>
      <style>{`
        .nf-post{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px}
        .nf-post.pinned{border-color:#fbbf24;border-left:4px solid #fbbf24}
        .nf-post-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px}
        .nf-post-title{font-size:15px;font-weight:800;color:#0f172a;margin:0 0 2px}
        .nf-post-meta{font-size:12px;color:#64748b}
        .nf-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:#f1f5f9;color:#475569;margin-left:8px}
        .nf-post-body{font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap}
        .nf-del-btn{font-size:12px;color:#dc2626;background:none;border:none;cursor:pointer;font-family:inherit;padding:0;opacity:.6}
        .nf-del-btn:hover{opacity:1}
        .nf-compose{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px}
        .nf-input{width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;outline:none}
        .nf-input:focus{border-color:#1e40af}
        .nf-save-btn{padding:9px 20px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .nf-save-btn:disabled{opacity:.5;cursor:not-allowed}
        .nf-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .nf-new-btn:hover{background:#1e40af;color:#fff}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {isAdmin && (
        <button className="nf-new-btn" onClick={() => setShowNew(!showNew)}>
          {showNew ? "✕ Cancel" : "+ New Post"}
        </button>
      )}

      {showNew && isAdmin && (
        <div className="nf-compose">
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Title</label>
            <input className="nf-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Post title…" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Content</label>
            <textarea className="nf-input" style={{ minHeight: 100, resize: "vertical" }} value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Write your message…" />
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Visibility</label>
              <select className="nf-input" style={{ width: "auto" }} value={newVis} onChange={(e) => setNewVis(e.target.value)}>
                <option value="all_staff">All Staff</option>
                <option value="clinicians_only">Clinicians Only</option>
                <option value="admin_only">Admin Only</option>
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", marginTop: 20 }}>
              <input type="checkbox" checked={newPinned} onChange={(e) => setNewPinned(e.target.checked)} /> Pin to top
            </label>
          </div>
          <button className="nf-save-btn" disabled={saving || !newTitle.trim() || !newBody.trim()} onClick={createPost}>
            {saving ? "Posting…" : "Post Update"}
          </button>
        </div>
      )}

      {posts.length === 0 && !showNew && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📢</div>
          <p style={{ fontSize: 13, margin: 0 }}>No posts yet. {isAdmin && "Create the first update for your team."}</p>
        </div>
      )}

      {posts.map((p) => (
        <div key={p.id} className={`nf-post${p.pinned ? " pinned" : ""}`}>
          <div className="nf-post-header">
            <div>
              <div className="nf-post-title">
                {p.pinned && <span style={{ marginRight: 6 }}>📌</span>}{p.title}
                <span className="nf-badge">{VISIBILITY_LABELS[p.visibility] ?? p.visibility}</span>
              </div>
              <div className="nf-post-meta">
                By {p.author_name} · {p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
              </div>
            </div>
            {isAdmin && <button className="nf-del-btn" onClick={() => void deletePost(p.id)}>✕ Delete</button>}
          </div>
          <div className="nf-post-body">{p.body}</div>
        </div>
      ))}
    </>
  );
}
