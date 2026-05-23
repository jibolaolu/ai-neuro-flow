import type { ReactNode } from "react";

export function FormShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--body-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          background: "rgba(255,255,255,0.85)",
          borderBottom: "1px solid var(--card-border)",
          backdropFilter: "blur(12px) saturate(1.2)",
          WebkitBackdropFilter: "blur(12px) saturate(1.2)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 24px",
          }}
        >
          <span
            style={{
              background: "var(--brand)",
              color: "#fff",
              borderRadius: 8,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 14,
              flexShrink: 0,
              boxShadow: "var(--shadow-brand)",
            }}
          >
            N
          </span>
          <div>
            <strong style={{ color: "var(--ink)", fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>
              Neuro Flow
            </strong>
            <small
              style={{
                display: "block",
                color: "var(--muted)",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Neuro Flow Clinical Platform
            </small>
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: "32px 16px 48px",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>{children}</div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--card-border)",
          padding: "20px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
          Neuro Flow Clinical Platform - Specialist ADHD and autism assessment
          services
        </p>
      </footer>
    </div>
  );
}
