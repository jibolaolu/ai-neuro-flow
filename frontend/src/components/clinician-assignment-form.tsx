"use client";

import { useCallback, useEffect, useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";

type ClinicianOption = { id: string; full_name: string; email: string; role: string };

function RoleChip({ role }: { role: string }) {
  const isSenior = role === "senior-clinician";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 10,
        background: isSenior ? "#7c5cfc18" : "#eff6ff",
        color: isSenior ? "#7c5cfc" : "#1d4ed8",
        border: `1px solid ${isSenior ? "#7c5cfc40" : "#bfdbfe"}`,
        flexShrink: 0,
      }}
    >
      {isSenior ? "Senior" : "Clinician"}
    </span>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #1d4ed8 0%, #7c5cfc 100%)",
        color: "#fff",
        fontWeight: 800,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
  );
}

export function ClinicianAssignmentForm({
  clientId,
  assignedClinicianUserId,
}: {
  clientId: string;
  assignedClinicianUserId: string | null;
}) {
  const [options, setOptions] = useState<ClinicianOption[]>([]);
  const [value, setValue] = useState(assignedClinicianUserId ?? "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(browserApiUrl("/api/v1/team/clinicians"), { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: ClinicianOption[] };
      setOptions(d.items ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setValue(assignedClinicianUserId ?? "");
  }, [assignedClinicianUserId]);

  const selected = options.find((c) => c.id === value) ?? null;

  async function handleSelect(id: string) {
    setValue(id);
    setOpen(false);
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const r = await fetch(
        browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/assignment`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinician_user_id: id || null }),
        },
      );
      if (!r.ok) {
        const b = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(b.detail ?? "Could not update assignment");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mini-card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: 4 }}>Assigned Clinician</h3>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Allocates the case in Neuro Flow (required for the clinician and senior portals).
      </p>

      {err && (
        <p className="inline-badge status-warn" role="alert" style={{ marginBottom: 12 }}>
          {err}
        </p>
      )}

      {/* Current selection display */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          border: `2px solid ${open ? "var(--brand, #1d4ed8)" : "var(--card-border)"}`,
          borderRadius: 10,
          cursor: "pointer",
          background: "var(--card-bg, #fff)",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          boxShadow: open ? "0 0 0 3px var(--brand-100, #bfdbfe)" : "none",
          userSelect: "none",
        }}
      >
        {selected ? (
          <>
            <AvatarInitials name={selected.full_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                {selected.full_name}
                <RoleChip role={selected.role} />
                {saving && <span style={{ fontSize: 11, color: "var(--muted)" }}>Saving...</span>}
                {saved && !saving && <span style={{ fontSize: 11, color: "#22a76a", fontWeight: 700 }}>Saved</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{selected.email}</div>
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--muted-100, #f0f0f0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18, color: "var(--muted)" }}>+</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--muted)" }}>
                {saving ? "Saving..." : "No clinician assigned"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Click to assign a clinician</div>
            </div>
          </>
        )}
        <span style={{ color: "var(--muted)", fontSize: 12, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Dropdown list */}
      {open && (
        <div style={{
          marginTop: 6,
          border: "1px solid var(--card-border)",
          borderRadius: 10,
          background: "var(--card-bg, #fff)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
          zIndex: 100,
          position: "relative",
        }}>
          {/* Unassign option */}
          <div
            onClick={() => void handleSelect("")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              cursor: "pointer",
              background: value === "" ? "var(--brand-50, #eff6ff)" : "transparent",
              borderBottom: "1px solid var(--muted-100)",
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => { if (value !== "") (e.currentTarget as HTMLDivElement).style.background = "var(--surface-50, #f9fafb)"; }}
            onMouseLeave={(e) => { if (value !== "") (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--muted-100, #f0f0f0)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 18, color: "var(--muted)" }}>-</span>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--muted)" }}>Unassigned</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Remove current assignment</div>
            </div>
            {value === "" && <span style={{ marginLeft: "auto", color: "var(--brand)", fontWeight: 700, fontSize: 13 }}>Current</span>}
          </div>

          {options.length === 0 && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
              No clinicians available
            </div>
          )}

          {options.map((c) => (
            <div
              key={c.id}
              onClick={() => void handleSelect(c.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                cursor: "pointer",
                background: value === c.id ? "var(--brand-50, #eff6ff)" : "transparent",
                borderBottom: "1px solid var(--muted-100)",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => { if (value !== c.id) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-50, #f9fafb)"; }}
              onMouseLeave={(e) => { if (value !== c.id) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <AvatarInitials name={c.full_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                  {c.full_name}
                  <RoleChip role={c.role} />
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
              </div>
              {value === c.id && (
                <span style={{ color: "var(--brand)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
