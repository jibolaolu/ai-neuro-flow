"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function getApiBase() { return process.env.NEXT_PUBLIC_API_BASE ?? ""; }

export function ClientPortalLogin() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No login token found in the link. Please request a new one from the clinic.");
      return;
    }

    void (async () => {
      try {
        const r = await fetch(`${getApiBase()}/api/v1/public/portal/authenticate?token=${encodeURIComponent(token)}`, {
          method: "POST",
          credentials: "include",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({ detail: "Authentication failed" }));
          setStatus("error");
          setMessage(j.detail ?? "Authentication failed. Your link may have expired.");
          return;
        }
        const j = await r.json();
        setClientId(j.client_id);
        setStatus("success");
        setTimeout(() => {
          router.replace(`/client-portal/${token}/messages`);
        }, 1500);
      } catch {
        setStatus("error");
        setMessage("Could not connect to the portal. Please try again later.");
      }
    })();
  }, [token, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 48, textAlign: "center", maxWidth: 420, width: "100%", boxShadow: "0 4px 32px rgba(0,0,0,.08)" }}>
        <div style={{ width: 60, height: 60, background: "#1e40af", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>
          {status === "loading" ? "⌛" : status === "success" ? "✅" : "⚠️"}
        </div>

        {status === "loading" && (
          <>
            <h2 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: "1.3rem" }}>Signing you in…</h2>
            <p style={{ color: "#64748b", fontSize: 14 }}>Verifying your secure login link.</p>
          </>
        )}

        {status === "success" && (
          <>
            <h2 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: "1.3rem" }}>Welcome back!</h2>
            <p style={{ color: "#64748b", fontSize: 14 }}>You&apos;re signed in. Redirecting to your portal…</p>
          </>
        )}

        {status === "error" && (
          <>
            <h2 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: "1.3rem" }}>Link unavailable</h2>
            <p style={{ color: "#64748b", fontSize: 14 }}>{message}</p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 16 }}>
              Please contact the clinic to request a new secure link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
