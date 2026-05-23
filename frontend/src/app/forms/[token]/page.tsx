import { notFound } from "next/navigation";

import { FormShell } from "../../../components/form-shell";
import { serverApiUrl } from "../../../lib/get-api-base";
import { FormRouter } from "./FormRouter";

async function getFormInfo(token: string) {
  try {
    const res = await fetch(serverApiUrl(`/api/v1/forms/info/${token}`), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function FormPage({
  params,
}: {
  params: { token: string };
}) {
  const info = await getFormInfo(params.token);
  if (!info) notFound();

  return (
    <FormShell>
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted)",
          }}
        >
          {info.form_label}
        </span>
        <h1
          style={{
            margin: "4px 0 8px",
            color: "var(--ink)",
            fontSize: "clamp(1.5rem, 4vw, 1.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {info.status === "submitted"
            ? "Form already submitted"
            : `Welcome, ${info.client_name}`}
        </h1>
        {info.status !== "submitted" && (
          <p style={{ color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
            Please complete all sections. Your responses are stored securely and
            used solely for your assessment.
          </p>
        )}
      </div>

      {info.status === "submitted" ? (
        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: "var(--radius-lg)",
            padding: "32px",
            border: "1px solid var(--card-border)",
            boxShadow: "var(--shadow-sm)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2
            style={{
              color: "var(--teal)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            Already submitted
          </h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            We have already received your completed form. Thank you.
          </p>
        </div>
      ) : (
        <FormRouter
          token={params.token}
          formType={info.form_type}
          clientName={info.client_name}
          clientEmail={info.client_email}
          prefill={info.prefill ?? {}}
        />
      )}
    </FormShell>
  );
}
