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
    <div className="workflow-stack" style={{ gap: "1rem" }}>
      {accountError && <p className="form-error">{accountError}</p>}
      <a
        href={auth0LoginUrl()}
        className="primary-action"
        style={{ width: "100%", justifyContent: "center", textAlign: "center", display: "flex" }}
      >
        Sign in with Auth0
      </a>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
        You will be redirected to our secure identity provider. Use the email your clinic registered for you.
      </p>
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

