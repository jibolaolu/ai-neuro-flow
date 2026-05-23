"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { TeamClinicianOut } from "../lib/api-server";
import { browserApiUrl } from "../lib/get-api-base";

function parseDetailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (typeof e === "object" && e && "msg" in e ? String((e as { msg?: string }).msg) : String(e))).join(", ");
  }
  return "Request failed";
}

export function ClinicianAdminPanel({ member: initial }: { member: TeamClinicianOut }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name);
  const [email, setEmail] = useState(initial.email);
  const [role, setRole] = useState(initial.role);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [addressLine, setAddressLine] = useState(initial.address_line ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial.date_of_birth ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setFullName(initial.full_name);
    setEmail(initial.email);
    setRole(initial.role);
    setPhone(initial.phone ?? "");
    setAddressLine(initial.address_line ?? "");
    setDateOfBirth(initial.date_of_birth ?? "");
    setPassword("");
    setPasswordConfirm("");
    setMsg(null);
    setErr(null);
  }, [
    initial.full_name,
    initial.email,
    initial.role,
    initial.is_active,
    initial.phone,
    initial.address_line,
    initial.date_of_birth,
  ]);

  const basePath = useMemo(
    () => `/api/v1/team/clinicians/${encodeURIComponent(initial.id)}`,
    [initial.id],
  );

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function patchBody(body: Record<string, unknown>) {
    const r = await fetch(browserApiUrl(basePath), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
      throw new Error(parseDetailMessage(j.detail));
    }
    return r.json() as Promise<TeamClinicianOut>;
  }

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (password || passwordConfirm) {
      if (password !== passwordConfirm) {
        setErr("Password and confirmation do not match.");
        return;
      }
      if (password.length < 8) {
        setErr("Password must be at least 8 characters.");
        return;
      }
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        phone: phone.trim() || null,
        address_line: addressLine.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
      };
      if (password) body.password = password;
      await patchBody(body);
      setPassword("");
      setPasswordConfirm("");
      setMsg("Saved.");
      refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (
      !window.confirm(
        "Deactivate this clinician? They will be signed out on the next request and cannot log in until an admin reactivates them.",
      )
    ) {
      return;
    }
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch(browserApiUrl(basePath), { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(parseDetailMessage(j.detail));
      }
      setMsg("Clinician deactivated.");
      refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not deactivate");
    } finally {
      setBusy(false);
    }
  }

  async function onReactivate() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await patchBody({ is_active: true });
      setMsg("Clinician reactivated.");
      refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not reactivate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`workspace-card${!initial.is_active ? " team-member-card-inactive" : ""}`}>
      <div className="workspace-card-header">
        <div>
          <span className="panel-label">Admin</span>
          <h2>Clinician account</h2>
        </div>
      </div>

      {err ? (
        <p className="inline-badge status-warn" role="alert" style={{ marginBottom: "1rem" }}>
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="inline-badge status-good" style={{ marginBottom: "1rem" }}>
          {msg}
        </p>
      ) : null}

      {!initial.is_active ? (
        <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: "1rem", lineHeight: 1.55 }}>
          This account is <strong>inactive</strong>. The clinician cannot log in or use the portal until you reactivate
          them.
        </p>
      ) : null}

      <form onSubmit={onSaveProfile} className="key-value-grid" style={{ gap: "1rem" }}>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Full name</span>
          <input
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={busy}
            autoComplete="name"
          />
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Email (login)</span>
          <input
            type="email"
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            autoComplete="email"
          />
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Role</span>
          <select
            className="patient-table-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
            style={{ minHeight: 40 }}
          >
            <option value="clinician">Clinician</option>
            <option value="senior-clinician">Senior clinician</option>
          </select>
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Phone</span>
          <input
            type="tel"
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            autoComplete="tel"
          />
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Address</span>
          <input
            type="text"
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            disabled={busy}
            placeholder="Street, city, postcode"
            autoComplete="street-address"
          />
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Date of birth</span>
          <input
            type="date"
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>New password (optional)</span>
          <input
            type="password"
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            disabled={busy}
            autoComplete="new-password"
          />
        </div>
        <div className="key-value-item" style={{ gridColumn: "1 / -1" }}>
          <span>Confirm new password</span>
          <input
            type="password"
            className="patient-table-input"
            style={{ minHeight: 40 }}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={busy}
            autoComplete="new-password"
          />
        </div>
        <div className="button-strip" style={{ gridColumn: "1 / -1", marginTop: "0.25rem" }}>
          <button type="submit" className="primary-action button-reset" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {initial.is_active ? (
            <button type="button" className="secondary-action button-reset" disabled={busy} onClick={() => void onDeactivate()}>
              Deactivate account
            </button>
          ) : (
            <button type="button" className="primary-action button-reset" disabled={busy} onClick={() => void onReactivate()}>
              Reactivate account
            </button>
          )}
        </div>
      </form>

      <p style={{ margin: "1.25rem 0 0", fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>
        User ID: {initial.id}
      </p>
    </article>
  );
}
