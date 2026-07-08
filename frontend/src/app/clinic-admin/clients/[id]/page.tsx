import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicianAssignmentForm } from "../../../../components/clinician-assignment-form";
import { ClientCaseNotesPanel } from "../../../../components/client-case-notes-panel";
import { ClientSlotReminderButton } from "../../../../components/client-slot-reminder";
import { PersonalDetailsEditor, ReferralDataPanel, RiskAssessmentPanel } from "../../../../components/client-record-panels";
import { DocumentWorkbench } from "../../../../components/document-workbench";
import { ClientFormsPanel } from "../../../../components/client-forms-panel";
import { ReportEditor } from "../../../../components/report-editor";
import { ConsentPanel } from "../../../../components/consent-panel";
import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { AiClinicalReportCard } from "../../../../components/ai-clinical-report-card";
import { AIAssistantPanel } from "../../../../components/ai-assistant-panel";
import { CalendarSyncButtons } from "../../../../components/calendar-sync-buttons";
import { getClinicAdminNav } from "../../../../lib/clinic-admin-nav";
import { getClient, getClientForms } from "../../../../lib/api";
import { getClientAuthedForAdmin, getClientEmailLogAuthed } from "../../../../lib/api-server";

const clientTabs = [
  { key: "overview", label: "Overview" },
  { key: "operational-record", label: "Operational record" },
  { key: "personal", label: "Personal" },
  { key: "referral", label: "Referral" },
  { key: "documentation", label: "Documentation" },
  { key: "risk-assessment", label: "Risk assessment" },
  { key: "reports", label: "Reports" },
  { key: "consents", label: "Consents" },
  { key: "billing", label: "Billing" },
  { key: "insurance", label: "Insurance" },
  { key: "notes", label: "Notes" },
] as const;

/** API form token status: pending = link sent, response not yet submitted (not "email failed"). */
function formResponseLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Received";
    case "reminded":
      return "Reminded - not returned";
    case "pending":
    default:
      return "Awaiting completion";
  }
}

const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  welcome_and_forms: "Welcome + intake form link",
  form_reminder: "Form reminder",
  third_party_form: "Teacher / GP questionnaire",
  forms_complete_admin: "Admin - all forms received",
  slot_selection_client: "Client - slot selection",
  booking_confirm_client: "Client - booking confirmation",
  booking_confirm_clinician: "Clinician - booking confirmation",
  generic: "Other",
};

export default async function ClinicAdminClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  const [clientAuth, forms, emailLog, clientPublic] = await Promise.all([
    getClientAuthedForAdmin(params.id),
    getClientForms(params.id),
    getClientEmailLogAuthed(params.id),
    getClient(params.id),
  ]);
  const client = clientAuth ?? clientPublic;

  if (!client) notFound();

  const activeTab = clientTabs.find((t) => t.key === searchParams?.tab)?.key ?? "overview";

  const formsReturnedComplete =
    client.status === "Forms Returned, Ready to Schedule" ||
    client.status === "Forms Returned" ||
    client.status === "Assessment Booked" ||
    client.status === "Scheduled" ||
    client.status === "Complete" ||
    !!client.confirmed_session_at;

  const isAssessmentScheduled = !!client.confirmed_session_at;

  const displayName = client.child_name ?? client.full_name;

  const statusColor: Record<string, string> = {
    New: "#2a4db7",
    "Forms Sent": "#2563eb",
    "Forms Returned": "#24b8b0",
    "Forms Returned, Ready to Schedule": "#24b8b0",
    Scheduled: "#7c5cfc",
    Complete: "#22a76a",
  };
  const badgeColor = statusColor[client.status] ?? "#65748f";
  const receivedDate = client.created_at
    ? new Date(client.created_at).toLocaleDateString("en-GB")
    : "-";

  return (
    <RoleDashboardShell
      role="clinic-admin"
      roleLabel="Clinic Admin"
      sectionLabel="Client Record"
      title="Client profile and care overview"
      navGroups={getClinicAdminNav("/clinic-admin/clients")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">

        {/* Header */}
        <section className="client-profile-header">
          <div>
            <Link className="client-breadcrumb" href="/clinic-admin/clients">
              Clients
            </Link>
            <h2>{displayName}</h2>
            <div className="info-chip-row">
              <span className="info-chip info-chip-accent">{client.status}</span>
              {client.pathway && <span className="info-chip info-chip-accent">{client.pathway}</span>}
            </div>
          </div>
          <div className="button-strip">
            <Link className="ghost-chip" href="/clinic-admin/clients">
              Back to clients
            </Link>
            <a className="ghost-chip" href={`mailto:${client.email}`}>
              Email client
            </a>
            <Link className="primary-action" href="/clinic-admin/calendar">
              Schedule appointment
            </Link>
          </div>
        </section>

        {/* Tabs */}
        <section className="record-tab-row">
          {clientTabs.map((tab) => (
            <Link
              className={`record-tab ${activeTab === tab.key ? "record-tab-active" : ""}`}
              href={`/clinic-admin/clients/${client.id}?tab=${tab.key}`}
              key={tab.key}
            >
              {tab.label}
            </Link>
          ))}
        </section>

        <section className="workspace-grid workspace-grid-client-record">

          {/* ── Main content ─────────────────────────────────────────── */}
          <article className="workspace-card">

            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <>
                <div className="workspace-card-header">
                  <div>
                    <span className="panel-label">Case Overview</span>
                    <h2>Client summary and intake tracker</h2>
                  </div>
                </div>

                <div className="appointment-history-shell">
                  <div className="appointment-history-summary">
                    <article className="history-stat-card">
                      <span>Assessment type</span>
                      <strong>{client.pathway ?? "-"}</strong>
                      <small>
                        {client.age_group ?? ""} pathway
                        {client.paid_service_name ? ` · ${client.paid_service_name}` : ""}
                      </small>
                    </article>
                    <article className="history-stat-card">
                      <span>Amount paid</span>
                      <strong>{client.payment_amount ? `${client.payment_currency ?? "GBP"} ${client.payment_amount}` : "-"}</strong>
                      <small>via {client.source}</small>
                    </article>
                    <article className="history-stat-card">
                      <span>Current stage</span>
                      <strong>{client.stage}</strong>
                      <small style={{ color: badgeColor }}>{client.status}</small>
                    </article>
                  </div>

                  <article className="mini-card extracted-from-forms-card" style={{ marginTop: "1.25rem" }}>
                    <h3>Extracted from forms</h3>
                    <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
                      Pulled automatically when intake or parent forms are submitted. Edit or complete details in the Personal tab.
                    </p>
                    <div className="client-identifiers-list">
                      {(
                        [
                          ["Paid service (checkout)", client.paid_service_name],
                          ["Date of birth", client.date_of_birth],
                          ["Address", client.address],
                          ["Phone", client.phone],
                          ["Occupation", client.occupation],
                          ["Medical concerns", client.medical_concerns],
                          ["GP name", client.gp_name],
                          ["GP practice", client.gp_practice],
                          ["GP email", client.gp_email],
                          ["Teacher name", client.teacher_name],
                          ["Teacher email", client.teacher_email],
                          ["School", client.school_name],
                          ["Parent / guardian", client.parent_guardian_name],
                          ["Parent / guardian phone", client.parent_guardian_phone],
                        ] as const
                      ).map(([label, value]) => (
                        <div className="client-identifier-row" key={label}>
                          <span className="client-identifier-label">{label}</span>
                          <span
                            className="client-identifier-value"
                            style={
                              label === "Medical concerns"
                                ? { whiteSpace: "pre-wrap" as const }
                                : undefined
                            }
                          >
                            {value?.trim() ? value : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <AiClinicalReportCard clientId={client.id} />

                  <ClinicianAssignmentForm
                    assignedClinicianUserId={client.assigned_clinician_user_id ?? null}
                    clientId={client.id}
                  />

                  <ClientSlotReminderButton
                    clientId={client.id}
                    status={client.status}
                    hasConfirmedSession={!!client.confirmed_session_at}
                  />

                  <div className="appointment-history-grid">
                    <article className="mini-card">
                      <h3>Workflow timeline</h3>
                      <div className="history-timeline">
                        <div className="history-timeline-row">
                          <span className="history-timeline-dot history-timeline-dot-done" />
                          <div>
                            <strong>Payment received</strong>
                            <p>{receivedDate}</p>
                          </div>
                        </div>
                        <div className="history-timeline-row">
                          <span className={`history-timeline-dot ${forms.length > 0 ? "history-timeline-dot-active" : ""}`} />
                          <div>
                            <strong>Intake forms dispatched</strong>
                            <p>{forms.length > 0 ? `${forms.length} form(s) sent` : "Pending"}</p>
                          </div>
                        </div>
                        <div className="history-timeline-row">
                          <span className={`history-timeline-dot ${formsReturnedComplete ? "history-timeline-dot-active" : ""}`} />
                          <div>
                            <strong>Forms returned</strong>
                            <p>{formsReturnedComplete ? "Complete" : "Awaiting"}</p>
                          </div>
                        </div>
                        <div className="history-timeline-row">
                          <span className={`history-timeline-dot ${isAssessmentScheduled ? "history-timeline-dot-active" : ""}`} />
                          <div>
                            <strong>Assessment scheduled</strong>
                            <p>
                              {isAssessmentScheduled
                                ? new Date(client.confirmed_session_at!).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                                : "Not yet booked"}
                            </p>
                            {isAssessmentScheduled && (
                              <div style={{ marginTop: 8 }}>
                                <CalendarSyncButtons clientId={client.id} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>

                    <article className="mini-card">
                      <h3>Intake forms tracker</h3>
                      {forms.length === 0 ? (
                        <p style={{ color: "var(--muted)", fontSize: 14 }}>No forms dispatched yet.</p>
                      ) : (
                        forms.map((f) => {
                          const c = f.status === "submitted" ? "#22a76a" : "#f59e0b";
                          return (
                            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--muted-100)" }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{f.form_label}</div>
                                <div style={{ fontSize: 12, color: "var(--muted)" }}>{f.recipient_email}</div>
                              </div>
                              <span
                                className={`inline-badge ${f.status === "submitted" ? "status-good" : "status-warn"}`}
                                title="Link emailed; this shows whether the form has been filled in."
                              >
                                {formResponseLabel(f.status)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </article>
                  </div>

                  <article className="mini-card" style={{ marginTop: "1.25rem" }}>
                    <h3>Outbound email log</h3>
                    <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
                      Copy of what we attempted to send (plain preview + optional HTML). Server logs also print{" "}
                      <code style={{ fontSize: 12 }}>Email payload | template=… | text_preview=…</code> on each attempt.
                    </p>
                    {emailLog.length === 0 ? (
                      <p style={{ color: "var(--muted)", fontSize: 14 }}>No email attempts recorded for this client yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {emailLog.map((row) => (
                          <details
                            key={row.id}
                            style={{
                              border: "1px solid var(--muted-100)",
                              borderRadius: 8,
                              padding: "10px 12px",
                              background: "var(--surface-50, rgba(0,0,0,0.02))",
                            }}
                          >
                            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                              {row.created_at ? new Date(row.created_at).toLocaleString("en-GB") : "-"} ·{" "}
                              {EMAIL_TEMPLATE_LABELS[row.template_key] ?? row.template_key} → {row.recipient_email}{" "}
                              <span
                                className={`inline-badge ${row.success ? "status-good" : "status-warn"}`}
                                style={{ marginLeft: 8 }}
                              >
                                {row.delivery_mode}
                                {row.sendgrid_status_code != null ? ` (${row.sendgrid_status_code})` : ""}
                              </span>
                            </summary>
                            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink)" }}>
                              <div>
                                <strong>Subject:</strong> {row.subject}
                              </div>
                              <div style={{ marginTop: 4 }}>
                                <strong>From:</strong> {row.from_email}
                              </div>
                              {!row.success && row.error_message && (
                                <div style={{ marginTop: 8, color: "#b45309" }}>
                                  <strong>Error:</strong> {row.error_message}
                                </div>
                              )}
                              {row.sendgrid_response_excerpt && (
                                <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                                  <strong>SendGrid response:</strong> {row.sendgrid_response_excerpt}
                                </div>
                              )}
                              <div style={{ marginTop: 10, whiteSpace: "pre-wrap", color: "var(--muted)" }}>
                                <strong style={{ color: "var(--ink)" }}>Text preview</strong>
                                <br />
                                {row.body_preview}
                              </div>
                              {row.html_snapshot && (
                                <details style={{ marginTop: 10 }}>
                                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>HTML snapshot (truncated)</summary>
                                  <pre
                                    style={{
                                      marginTop: 8,
                                      padding: 10,
                                      background: "var(--muted-50, #f4f6fb)",
                                      borderRadius: 6,
                                      overflow: "auto",
                                      maxHeight: 280,
                                      fontSize: 11,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {row.html_snapshot}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              </>
            )}

            {/* OPERATIONAL RECORD */}
            {activeTab === "operational-record" && (
              <>
                <div className="workspace-card-header">
                  <div>
                    <span className="panel-label">Operational record</span>
                    <h2>Client record and admin operations</h2>
                  </div>
                </div>

                <div className="detail-metadata portal-summary-grid">
                  <article>
                    <span>Client ID</span>
                    <strong>{client.id}</strong>
                  </article>
                  <article>
                    <span>Assessment ID</span>
                    <strong>{client.assessment_id ?? "-"}</strong>
                  </article>
                  <article>
                    <span>Email</span>
                    <strong>{client.email}</strong>
                  </article>
                  <article>
                    <span>Received</span>
                    <strong>{receivedDate}</strong>
                  </article>
                  <article>
                    <span>GP</span>
                    <strong>{client.gp_name ?? "-"}</strong>
                  </article>
                  <article>
                    <span>Practice</span>
                    <strong>{client.gp_practice ?? "-"}</strong>
                  </article>
                  <article>
                    <span>GP email</span>
                    <strong>{client.gp_email ?? "-"}</strong>
                  </article>
                  <article>
                    <span>Next contact</span>
                    <strong>-</strong>
                  </article>
                </div>

                <article className="mini-card">
                  <h3>Patient record</h3>
                  <div className="detail-metadata portal-summary-grid operational-record-grid">
                    <article>
                      <span>Date of birth</span>
                      <strong>{client.date_of_birth ?? "-"}</strong>
                    </article>
                    <article>
                      <span>NHS number</span>
                      <strong>-</strong>
                    </article>
                    <article>
                      <span>Allocated clinician</span>
                      <strong>{client.assigned_clinician_name ?? "-"}</strong>
                    </article>
                    <article>
                      <span>Report due</span>
                      <strong>
                        {client.report_due_at
                          ? new Date(client.report_due_at).toLocaleDateString("en-GB")
                          : "-"}
                      </strong>
                    </article>
                  </div>
                </article>

                <article className="mini-card">
                  <h3>Intake forms log</h3>
                  {forms.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>No forms dispatched yet.</p>
                  ) : (
                    <div className="activity-stack">
                      {forms.map((f) => (
                        <div className="activity-row" key={f.id}>
                          <div className="activity-meta">
                            <span>Form</span>
                            <strong>{f.form_label}</strong>
                          </div>
                          <div className="activity-copy">
                            <p>{f.recipient_email}</p>
                            <small>
                              Sent {f.sent_at ? new Date(f.sent_at).toLocaleDateString("en-GB") : "-"} ·
                              Response: {formResponseLabel(f.status)}
                              {f.submitted_at ? ` · Submitted ${new Date(f.submitted_at).toLocaleDateString("en-GB")}` : ""}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="mini-card">
                  <h3>Admin operations</h3>
                  <div className="button-strip">
                    <Link className="ghost-chip" href="/clinic-admin/calendar">
                      Schedule appointment
                    </Link>
                    <a className="ghost-chip" href={`mailto:${client.email}`}>
                      Email client
                    </a>
                  </div>
                  <ClientSlotReminderButton
                    clientId={client.id}
                    status={client.status}
                    hasConfirmedSession={!!client.confirmed_session_at}
                  />
                </article>

                <article className="mini-card">
                  <h3>Documents</h3>
                  <DocumentWorkbench clientId={client.id} roleLabel="Clinic Operations Admin" />
                </article>
              </>
            )}

            {/* PERSONAL */}
            {activeTab === "personal" && <PersonalDetailsEditor client={client} />}

            {/* REFERRAL */}
            {activeTab === "referral" && <ReferralDataPanel client={client} />}

            {/* DOCUMENTATION */}
            {activeTab === "documentation" && (
              <>
                <article className="mini-card">
                  <h3>Clinical forms</h3>
                  <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0, marginBottom: 16 }}>
                    All forms sent to the client, parent, teacher, or GP. Click "View responses" on any received form to see the filled answers.
                  </p>
                  <ClientFormsPanel forms={forms} />
                </article>
                <article className="mini-card">
                  <h3>Uploaded documents</h3>
                  <DocumentWorkbench clientId={client.id} roleLabel="Clinic Operations Admin" />
                </article>
              </>
            )}

            {/* RISK ASSESSMENT */}
            {activeTab === "risk-assessment" && <RiskAssessmentPanel client={client} />}

            {/* REPORTS */}
            {activeTab === "reports" && (
              <>
                <AIAssistantPanel clientId={client.id} tools={["report", "qa", "synthesis", "risk"]} />
                <ReportEditor client={client} userRole="clinic-admin" />
              </>
            )}

            {/* CONSENTS */}
            {activeTab === "consents" && <ConsentPanel client={client} />}

            {/* BILLING */}
            {activeTab === "billing" && (
              <article className="mini-card">
                <h3>Billing overview</h3>
                <div className="billing-summary-grid">
                  <div className="billing-summary-card">
                    <span>Total paid</span>
                    <strong>{client.payment_amount ? `${client.payment_currency ?? "GBP"} ${client.payment_amount}` : "-"}</strong>
                  </div>
                  <div className="billing-summary-card">
                    <span>Uninvoiced</span>
                    <strong>GBP 0</strong>
                  </div>
                  <div className="billing-summary-card">
                    <span>Account credit</span>
                    <strong>GBP 0</strong>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Payment reference</div>
                  <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--ink)" }}>{client.assessment_id ?? "-"}</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Source</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{client.source}</div>
                </div>
              </article>
            )}

            {/* INSURANCE */}
            {activeTab === "insurance" && (
              <article className="mini-card">
                <h3>Insurance</h3>
                <p>No insurer has been attached to this pathway. Direct self-pay workflow remains active.</p>
              </article>
            )}

            {activeTab === "notes" && <ClientCaseNotesPanel clientId={client.id} />}

          </article>

          {/* ── Side panel ───────────────────────────────────────────── */}
          <article className="workspace-card workspace-detail">
            <div className="workspace-card-header workspace-detail-stage-header">
              <div>
                <span className="panel-label">Current Stage</span>
                <h2>{client.stage}</h2>
              </div>
            </div>

            <article className="mini-card client-identifiers-card">
              <h3>Client identifiers</h3>
              <div className="client-identifiers-list">
                <div className="client-identifier-row">
                  <span className="client-identifier-label">Client ID</span>
                  <span className="client-identifier-value client-identifier-value--mono">{client.id}</span>
                </div>
                <div className="client-identifier-row">
                  <span className="client-identifier-label">Assessment ID</span>
                  <span className="client-identifier-value client-identifier-value--mono">{client.assessment_id ?? "-"}</span>
                </div>
                <div className="client-identifier-row">
                  <span className="client-identifier-label">Email</span>
                  <a className="client-identifier-value" href={`mailto:${client.email}`}>
                    {client.email}
                  </a>
                </div>
                <div className="client-identifier-row">
                  <span className="client-identifier-label">Source</span>
                  <span className="client-identifier-value client-identifier-value--muted">{client.source}</span>
                </div>
              </div>
            </article>

            <article className="mini-card">
              <h3>Labels</h3>
              <div className="info-chip-row">
                <span className="info-chip info-chip-accent">{client.status}</span>
                {client.pathway && <span className="info-chip info-chip-accent">{client.pathway}</span>}
                {client.age_group && <span className="info-chip info-chip-accent">{client.age_group}</span>}
              </div>
            </article>

            <article className="mini-card">
              <h3>Forms status</h3>
              {forms.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No forms sent yet.</p>
              ) : (
                forms.map((f) => {
                  const c = f.status === "submitted" ? "#22a76a" : "#f59e0b";
                  return (
                    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                      <span style={{ color: "var(--muted)" }}>{f.form_label}</span>
                      <span
                        className={`inline-badge ${f.status === "submitted" ? "status-good" : "status-warn"}`}
                        title="Link emailed; this shows whether the form has been returned."
                      >
                        {formResponseLabel(f.status)}
                      </span>
                    </div>
                  );
                })
              )}
            </article>
          </article>

        </section>
      </div>
    </RoleDashboardShell>
  );
}
