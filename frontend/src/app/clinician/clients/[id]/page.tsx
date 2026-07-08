import Link from "next/link";
import { cookies } from "next/headers";

import { ClientCaseNotesPanel } from "../../../../components/client-case-notes-panel";
import { CalendarSyncButtons } from "../../../../components/calendar-sync-buttons";
import { PersonalDetailsEditor, ReferralDataPanel, RiskAssessmentPanel } from "../../../../components/client-record-panels";
import { DocumentWorkbench } from "../../../../components/document-workbench";
import { ClientFormsPanel } from "../../../../components/client-forms-panel";
import { ReportEditor } from "../../../../components/report-editor";
import { ConsentPanel } from "../../../../components/consent-panel";
import { RoleDashboardShell } from "../../../../components/role-dashboard-shell";
import { AIAssistantPanel } from "../../../../components/ai-assistant-panel";
import { getClientForms } from "../../../../lib/api";
import { getClientCareRecord } from "../../../../lib/api-server";
import { getClinicalStaffNav } from "../../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../../lib/mock-auth";

const clinicianTabs = [
  { key: "operational-record", label: "Operational record" },
  { key: "personal", label: "Personal" },
  { key: "referral", label: "Referral" },
  { key: "documentation", label: "Documentation" },
  { key: "risk-assessment", label: "Risk assessment" },
  { key: "reports", label: "Reports" },
  { key: "consents", label: "Consents" },
  { key: "insurance", label: "Insurance" },
  { key: "notes", label: "Notes" },
] as const;

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

export default async function ClinicianClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  const cookieStore = await cookies();
  const staffRole =
    cookieStore.get(MOCK_ROLE_COOKIE)?.value === "senior-clinician" ? "senior-clinician" : "clinician";

  const activeTab = clinicianTabs.find((t) => t.key === searchParams?.tab)?.key ?? "operational-record";

  const [client, forms] = await Promise.all([getClientCareRecord(params.id), getClientForms(params.id)]);

  if (!client) {
    return (
      <RoleDashboardShell
        role={staffRole}
        roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
        sectionLabel="Clients"
        title="Client profile"
        navGroups={getClinicalStaffNav(staffRole, "/clinician/clients")}
      >
        <div className="page-shell compact-shell">
          <p>
            We could not open this client - you may not be assigned to them, or the record does not exist. Return to your list
            and sign in again if the problem continues.
          </p>
          <Link className="primary-action" href="/clinician/clients">
            Back to clients
          </Link>
        </div>
      </RoleDashboardShell>
    );
  }

  const receivedDate = client.created_at ? new Date(client.created_at).toLocaleDateString("en-GB") : "-";
  const allocated = client.assigned_clinician_name ?? "-";
  const displayName = client.child_name ?? client.full_name;

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
      sectionLabel="Client profile"
      title={displayName}
      navGroups={getClinicalStaffNav(staffRole, "/clinician/clients")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <section className="client-profile-header">
          <div>
            <Link className="client-breadcrumb" href="/clinician/clients">
              Patients
            </Link>
            <h2>{displayName}</h2>
            <div className="info-chip-row">
              <span className="info-chip info-chip-accent">{client.status}</span>
              {client.pathway ? <span className="info-chip info-chip-accent">{client.pathway}</span> : null}
              {client.assessment_id ? (
                <span className="info-chip">{client.assessment_id}</span>
              ) : (
                <span className="info-chip">{client.id}</span>
              )}
            </div>
          </div>
          <div className="button-strip">
            <Link className="ghost-chip" href="/clinician/clients">
              Back to patients
            </Link>
            {client.email ? (
              <a className="ghost-chip" href={`mailto:${client.email}`}>
                Email patient
              </a>
            ) : null}
          </div>
        </section>

        <p className="registration-note" style={{ marginTop: "0.25rem" }}>
          Clinical record - billing and payment details are not shown here. Contact Clinical Admin for invoices or payment
          history.
        </p>

        <section className="record-tab-row">
          {clinicianTabs.map((tab) => (
            <Link
              className={`record-tab ${activeTab === tab.key ? "record-tab-active" : ""}`}
              href={`/clinician/clients/${client.id}?tab=${tab.key}`}
              key={tab.key}
            >
              {tab.label}
            </Link>
          ))}
        </section>

        <section className="workspace-grid workspace-grid-client-record">
          <article className="workspace-card">
            {activeTab === "operational-record" && (
              <>
                <div className="workspace-card-header">
                  <div>
                    <span className="panel-label">Operational record</span>
                    <h2>Client record</h2>
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
                    <span>Accessibility</span>
                    <strong>-</strong>
                  </article>
                  <article>
                    <span>Next contact</span>
                    <strong>-</strong>
                  </article>
                </div>

                {client.confirmed_session_at && (
                  <article className="mini-card" style={{ paddingBottom: 16 }}>
                    <h3>Assessment appointment</h3>
                    <p style={{ fontSize: 13, color: "var(--ink)", marginTop: 0 }}>
                      <strong>{new Date(client.confirmed_session_at).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })}</strong>
                    </p>
                    <CalendarSyncButtons clientId={client.id} />
                  </article>
                )}

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
                      <strong>{allocated}</strong>
                    </article>
                    <article>
                      <span>Report due</span>
                      <strong>
                        {client.report_due_at ? new Date(client.report_due_at).toLocaleDateString("en-GB") : "-"}
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
                              Sent {f.sent_at ? new Date(f.sent_at).toLocaleDateString("en-GB") : "-"} · Response:{" "}
                              {formResponseLabel(f.status)}
                              {f.submitted_at ? ` · Submitted ${new Date(f.submitted_at).toLocaleDateString("en-GB")}` : ""}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="mini-card">
                  <h3>Documents</h3>
                  <DocumentWorkbench clientId={client.id} roleLabel={staffRole === "senior-clinician" ? "Senior clinician" : "Clinician"} />
                </article>
              </>
            )}

            {activeTab === "personal" && <PersonalDetailsEditor client={client} />}

            {activeTab === "referral" && <ReferralDataPanel client={client} />}

            {activeTab === "documentation" && (
              <>
                <article className="mini-card">
                  <h3>Clinical forms</h3>
                  <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0, marginBottom: 16 }}>
                    All forms sent and received for this client. Click "View responses" to read submitted answers. AI analysis is not shown here.
                  </p>
                  <ClientFormsPanel forms={forms} />
                </article>
                <article className="mini-card">
                  <h3>Uploaded documents</h3>
                  <DocumentWorkbench clientId={client.id} roleLabel={staffRole === "senior-clinician" ? "Senior clinician" : "Clinician"} />
                </article>
              </>
            )}

            {activeTab === "risk-assessment" && <RiskAssessmentPanel client={client} />}

            {activeTab === "reports" && (
              <>
                <AIAssistantPanel
                  clientId={client.id}
                  tools={["report", "soap", "qa", "synthesis", "risk"]}
                />
                <ReportEditor client={client} userRole={staffRole} />
              </>
            )}

            {activeTab === "consents" && <ConsentPanel client={client} />}

            {activeTab === "insurance" && (
              <article className="mini-card">
                <h3>Insurance</h3>
                <p>No insurer has been attached to this pathway. Direct self-pay workflow remains active.</p>
              </article>
            )}

            {activeTab === "notes" && <ClientCaseNotesPanel clientId={client.id} />}
          </article>

          <article className="workspace-card workspace-detail">
            <div className="workspace-card-header workspace-detail-stage-header">
              <div>
                <span className="panel-label">Current stage</span>
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
              </div>
            </article>

            <article className="mini-card">
              <h3>Labels</h3>
              <div className="info-chip-row">
                <span className="info-chip info-chip-accent">{client.status}</span>
                {client.pathway ? <span className="info-chip info-chip-accent">{client.pathway}</span> : null}
                {client.age_group ? <span className="info-chip info-chip-accent">{client.age_group}</span> : null}
              </div>
            </article>

            <article className="mini-card">
              <h3>Forms status</h3>
              {forms.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No forms sent yet.</p>
              ) : (
                forms.map((f) => (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                    <span style={{ color: "var(--muted)" }}>{f.form_label}</span>
                    <span
                      className={`inline-badge ${f.status === "submitted" ? "status-good" : "status-warn"}`}
                      title="Link emailed; this shows whether the form has been returned."
                    >
                      {formResponseLabel(f.status)}
                    </span>
                  </div>
                ))
              )}
            </article>
          </article>
        </section>
      </div>
    </RoleDashboardShell>
  );
}
