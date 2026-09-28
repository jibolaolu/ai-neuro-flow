"use client";

import { useCallback, useEffect, useState } from "react";

type Policy = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  visibility: string;
  content: string | null;
  file_name: string | null;
  version: string | null;
  review_date: string | null;
  is_ai_generated: boolean;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

const VIS_LABELS: Record<string, string> = {
  all_staff: "All Staff",
  senior_up: "Senior & Above",
  admin_only: "Admin Only",
};

const VIS_COLORS: Record<string, string> = {
  all_staff: "#dcfce7",
  senior_up: "#fef9c3",
  admin_only: "#fce7f3",
};

export function PoliciesContent({ isAdmin = false }: { isAdmin?: boolean }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selected, setSelected] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newVis, setNewVis] = useState("all_staff");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`${getApiBase()}/api/v1/policies/`, { credentials: "include" });
    const j = await r.json().catch(() => ({ items: [] }));
    setPolicies(j.items ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createPolicy() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/policies/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc || null, category: newCat || null, visibility: newVis, content: newContent || null }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowNew(false); setNewTitle(""); setNewDesc(""); setNewCat(""); setNewContent("");
      void load();
    } catch { setError("Failed to create policy"); }
    finally { setSaving(false); }
  }

  async function generatePolicy() {
    if (!newTitle.trim()) { setError("Please enter a title first"); return; }
    setGenerating(true);
    try {
      const r = await fetch(`${getApiBase()}/api/v1/policies/generate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, category: newCat || null, visibility: newVis }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowNew(false); setNewTitle(""); setNewCat(""); setNewVis("all_staff");
      void load();
    } catch { setError("AI generation failed"); }
    finally { setGenerating(false); }
  }

  async function deletePolicy(id: string) {
    if (!confirm("Delete this policy?")) return;
    await fetch(`${getApiBase()}/api/v1/policies/${id}`, { method: "DELETE", credentials: "include" });
    if (selected?.id === id) setSelected(null);
    void load();
  }

  return (
    <>
      <style>{`
        .pol-layout{display:grid;grid-template-columns:280px 1fr;gap:0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;min-height:500px}
        .pol-sidebar{border-right:1px solid #e2e8f0;background:#fff;overflow-y:auto}
        .pol-item{padding:12px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .12s}
        .pol-item:hover{background:#f8fafc}
        .pol-item.active{background:#eff6ff}
        .pol-item-title{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px}
        .pol-item-meta{font-size:11px;color:#94a3b8}
        .pol-badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:99px}
        .pol-detail{padding:24px;background:#fff;overflow-y:auto}
        .pol-content{font-size:13px;color:#374151;line-height:1.8;white-space:pre-wrap}
        .pol-input{width:100%;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;outline:none}
        .pol-input:focus{border-color:#1e40af}
        .pol-new-btn{padding:8px 16px;background:#eff6ff;color:#1e40af;border:1.5px solid #1e40af;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
        .pol-new-btn:hover{background:#1e40af;color:#fff}
        .pol-save-btn{padding:9px 18px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .pol-save-btn:disabled{opacity:.5}
        .pol-ai-btn{padding:9px 18px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:8px}
        .pol-ai-btn:disabled{opacity:.5}
      `}</style>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {isAdmin && (
        <button className="pol-new-btn" onClick={() => setShowNew(!showNew)}>
          {showNew ? "✕ Cancel" : "+ New Policy"}
        </button>
      )}

      {showNew && isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>New Policy</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Title *</label>
              <input className="pol-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Policy title…" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Category</label>
              <input className="pol-input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Clinical, HR, Safety…" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Visibility</label>
            <select className="pol-input" style={{ width: "auto" }} value={newVis} onChange={(e) => setNewVis(e.target.value)}>
              <option value="all_staff">All Staff</option>
              <option value="senior_up">Senior & Above</option>
              <option value="admin_only">Admin Only</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 }}>Content (optional — or use AI generate)</label>
            <textarea className="pol-input" style={{ minHeight: 100, resize: "vertical" }} value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Policy content…" />
          </div>
          <div>
            <button className="pol-save-btn" disabled={saving || !newTitle.trim()} onClick={createPolicy}>{saving ? "Saving…" : "Save Policy"}</button>
            <button className="pol-ai-btn" disabled={generating || !newTitle.trim()} onClick={generatePolicy}>{generating ? "Generating…" : "✨ AI Generate"}</button>
          </div>
        </div>
      )}

      <div className="pol-layout">
        <div className="pol-sidebar">
          {policies.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No policies yet</div>
          ) : policies.map((p) => (
            <div key={p.id} className={`pol-item${selected?.id === p.id ? " active" : ""}`} onClick={() => setSelected(p)}>
              <div className="pol-item-title">{p.title}</div>
              <div className="pol-item-meta">
                {p.category && <span style={{ marginRight: 8 }}>{p.category}</span>}
                <span className="pol-badge" style={{ background: VIS_COLORS[p.visibility] ?? "#f1f5f9" }}>{VIS_LABELS[p.visibility] ?? p.visibility}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="pol-detail">
          {selected ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>{selected.title}</h3>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    v{selected.version ?? "1.0"} · {VIS_LABELS[selected.visibility] ?? selected.visibility}
                    {selected.is_ai_generated && <span style={{ marginLeft: 8, background: "#f3e8ff", color: "#7c3aed", padding: "1px 6px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>✨ AI</span>}
                    {selected.review_date && <span style={{ marginLeft: 8 }}>· Review: {selected.review_date}</span>}
                    · By {selected.created_by_name ?? "—"}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => void deletePolicy(selected.id)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", opacity: .7 }}>✕ Delete</button>
                )}
              </div>
              {selected.description && <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{selected.description}</p>}
              {selected.content ? (
                <div className="pol-content">{selected.content}</div>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>No content. {selected.file_name ? `File: ${selected.file_name}` : "Add content by editing this policy."}</p>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
              <p style={{ fontSize: 13, margin: 0 }}>Select a policy to view</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
