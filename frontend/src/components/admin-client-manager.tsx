"use client";

import { useState } from "react";

type ClientItem = {
  id: string;
  clientName: string;
  pathway: string;
  source: string;
  status: string;
};

export function AdminClientManager({
  initialClients,
}: {
  initialClients: ClientItem[];
}) {
  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [clientName, setClientName] = useState("");
  const [dob, setDob] = useState("");
  const [source, setSource] = useState("GP referral");
  const [pathway, setPathway] = useState("Adult ADHD Assessment");

  function addManualClient() {
    if (!clientName.trim()) return;

    const route = dob && Number.parseInt(dob.slice(0, 4), 10) > 2010 ? "Child" : "Adult";

    setClients((current) => [
      {
        id: `NA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        clientName: clientName.trim(),
        pathway: route === "Child" ? "Child ADHD and Autism Assessment" : pathway,
        source,
        status: "Manually added",
      },
      ...current,
    ]);

    setClientName("");
    setDob("");
    setSource("GP referral");
    setPathway("Adult ADHD Assessment");
  }

  function addWebhookClient() {
    setClients((current) => [
      {
        id: `NA-WH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        clientName: "Webhook Intake Client",
        pathway: "Adult ADHD Assessment",
        source: "Neuro Flow webhook",
        status: "Payment received",
      },
      ...current,
    ]);
  }

  function removeClient(id: string) {
    setClients((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="workspace-grid">
      <article className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Manual Intake</span>
            <h2>Create a client record</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Client name</span>
            <input value={clientName} onChange={(event) => setClientName(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Date of birth</span>
            <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Referral source</span>
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option>GP referral</option>
              <option>Right to Choose</option>
              <option>Self-pay</option>
            </select>
          </label>
          <label className="form-field">
            <span>Initial pathway</span>
            <select value={pathway} onChange={(event) => setPathway(event.target.value)}>
              <option>Adult ADHD Assessment</option>
              <option>Adult Autism Assessment</option>
              <option>Combined ADHD and Autism Assessment</option>
            </select>
          </label>
        </div>

        <div className="button-strip">
          <button className="primary-action action-button" onClick={addManualClient} type="button">
            Add client
          </button>
          <button className="ghost-chip action-button" onClick={addWebhookClient} type="button">
            Simulate webhook add
          </button>
        </div>

        <article className="mini-card">
          <h3>Admin logic</h3>
          <ul className="clean-list">
            <li>Clinic admin can add a client manually when intake starts outside the payment flow.</li>
            <li>Clients can also be added via API integration when enabled for your clinic.</li>
            <li>Removing a client here removes them from the preview list only and does not affect the core workflow logic.</li>
          </ul>
        </article>
      </article>

      <article className="workspace-card workspace-detail">
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Client Directory</span>
            <h2>Client list preview</h2>
          </div>
        </div>

        <div className="mock-list">
          {clients.map((client) => (
            <div className="mock-list-row" key={client.id}>
              <div>
                <strong>{client.clientName}</strong>
                <p>
                  {client.pathway} · {client.source}
                </p>
                <small>
                  {client.id} · {client.status}
                </small>
              </div>
              <button className="secondary-action action-button" onClick={() => removeClient(client.id)} type="button">
                Remove
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
