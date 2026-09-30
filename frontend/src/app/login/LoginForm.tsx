"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { auth0LoginUrl } from "../../lib/auth0-config";

type Props = {
  auth0: boolean;
};

export function LoginForm({ auth0 }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const accountError =
    searchParams.get("error") === "no_account"
      ? "Your Auth0 account is not linked to a Neuro Flow user. Ask your clinic admin to invite you, or complete clinic registration first."
      : "";

  if (auth0) {
    return <Auth0LoginBlock accountError={accountError} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error;
        setError(
          typeof msg === "string" ? msg : "Sign in failed. Check your credentials.",
        );
        return;
      }

      router.push(data.redirect);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="workflow-stack" style={{ gap: "1rem" }}>
      <EmailPasswordFields
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
      />

      {(accountError || error) && (
        <p className="form-error" style={{ margin: 0 }}>
          {accountError || error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="primary-action"
        style={{
          width: "100%",
          justifyContent: "center",
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Auth0LoginBlock({ accountError }: { accountError: string }) {
  return (
    <div className="workflow-stack" style={{ gap: "1.25rem" }}>
      {accountError && (
        <div style={{
          background: "var(--danger-50, #fef2f2)",
          border: "1px solid var(--danger-100, #fecaca)",
          borderRadius: "var(--radius-sm, 6px)",
          padding: "12px 14px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--danger, #dc2626)" }}>{accountError}</p>
        </div>
      )}

      <a
        href={auth0LoginUrl()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: "13px 24px",
          background: "var(--brand, #1d4ed8)",
          color: "#fff",
          borderRadius: "var(--radius-sm, 6px)",
          fontWeight: 700,
          fontSize: "0.95rem",
          textDecoration: "none",
          boxShadow: "0 1px 3px rgba(0,0,0,.15)",
          transition: "opacity .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Continue securely with Auth0
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: "0.78rem" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Redirects to our secure identity provider. Use the email your clinic registered for you.</span>
      </div>
    </div>
  );
}

function EmailPasswordFields({
  email,
  setEmail,
  password,
  setPassword,
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="form-field">
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="text"
          inputMode="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="form-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
    </>
  );
}

