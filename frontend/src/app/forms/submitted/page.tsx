import { FormShell } from "../../../components/form-shell";

export default function FormSubmittedPage() {
  return (
    <FormShell>
      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          padding: "48px 32px",
          maxWidth: 520,
          margin: "0 auto",
          textAlign: "center",
          border: "1px solid var(--card-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--teal-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 32,
            border: "1px solid rgba(13,148,136,0.15)",
          }}
        >
          ✓
        </div>
        <h1
          style={{
            color: "var(--teal)",
            marginBottom: 12,
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Forms submitted
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 8, lineHeight: 1.6 }}>
          Thank you - we have received your completed form.
        </p>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7 }}>
          Our clinical team will review your responses and be in touch shortly
          to arrange your assessment appointment. If you provided teacher or GP
          contact details, they will receive their forms automatically.
        </p>
        <p style={{ marginTop: 32, fontSize: 13, color: "var(--muted)" }}>
          Questions? Contact us at{" "}
          <a
            href="mailto:support@neuroflow.app"
            style={{ color: "var(--brand)", fontWeight: 700 }}
          >
            support@neuroflow.app
          </a>
        </p>
      </div>
    </FormShell>
  );
}
