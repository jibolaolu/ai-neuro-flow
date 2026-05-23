"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { browserApiUrl } from "../lib/get-api-base";

export type ClientDocumentRow = {
  id: string;
  title: string;
  document_type: string;
  file_type: string;
  size_bytes: number;
  uploaded_at: string | null;
  uploaded_by: string;
  audience: string;
};

type UploadAudience = "Admin only" | "Clinician" | "Client portal" | "Shared";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatUploadedAt(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "-";
  }
}

function buildPreviewSummary(document: ClientDocumentRow) {
  return [
    `${document.title} is available for ${document.audience.toLowerCase()} access.`,
    `Stored as a ${document.file_type} ${document.document_type.toLowerCase()} and uploaded by ${document.uploaded_by}.`,
    `Uploaded ${formatUploadedAt(document.uploaded_at)} (${formatSize(document.size_bytes)}).`,
  ];
}

function fileUrl(clientId: string, docId: string, download: boolean) {
  const q = download ? "?download=true" : "";
  return browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}/file${q}`);
}

export function DocumentWorkbench({ clientId, roleLabel }: { clientId: string; roleLabel: string }) {
  const [documents, setDocuments] = useState<ClientDocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("Clinical report");
  const [audience, setAudience] = useState<UploadAudience>("Shared");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    setLoading(true);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/documents`), {
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as { items?: ClientDocumentRow[]; detail?: unknown };
      if (!r.ok) {
        const d = j.detail;
        throw new Error(typeof d === "string" ? d : "Could not load documents");
      }
      const items = j.items ?? [];
      setDocuments(items);
      setSelectedId((cur) => {
        if (cur && items.some((x) => x.id === cur)) return cur;
        return items[0]?.id ?? null;
      });
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load documents");
      setDocuments([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? documents[0] ?? null,
    [documents, selectedId],
  );

  function openPreview(docId: string) {
    window.open(fileUrl(clientId, docId, false), "_blank", "noopener,noreferrer");
  }

  function openDownload(docId: string) {
    window.open(fileUrl(clientId, docId, true), "_blank", "noopener,noreferrer");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadErr(null);
    if (!pickedFile || pickedFile.size === 0) {
      setUploadErr("Choose a non-empty file before uploading.");
      return;
    }

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("document_type", documentType);
    fd.append("audience", audience);
    fd.append("file", pickedFile);

    setUploadBusy(true);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/documents`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as { detail?: unknown } & Partial<ClientDocumentRow>;
      if (!r.ok) {
        const d = j.detail;
        throw new Error(typeof d === "string" ? d : "Upload failed");
      }
      setTitle("");
      setDocumentType("Clinical report");
      setAudience("Shared");
      setPickedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      if (typeof j.id === "string") setSelectedId(j.id);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  const canSubmit = Boolean(pickedFile && pickedFile.size > 0 && !uploadBusy);

  return (
    <div className="document-workbench">
      {loadErr ? (
        <p className="inline-badge status-warn" role="alert" style={{ marginBottom: "0.75rem" }}>
          {loadErr}
        </p>
      ) : null}

      <div className="document-workbench-layout">
        <div className="data-table-shell">
          <div className="data-table">
            <div className="data-table-head data-table-documents data-table-documents-interactive">
              <span>Title</span>
              <span>Type</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span>Actions</span>
            </div>
            {loading ? (
              <div className="data-table-row data-table-documents" style={{ padding: "1rem", color: "var(--muted)" }}>
                Loading documents…
              </div>
            ) : documents.length === 0 ? (
              <div className="data-table-row data-table-documents" style={{ padding: "1rem", color: "var(--muted)" }}>
                No documents yet. Upload a file below.
              </div>
            ) : (
              documents.map((document) => (
                <div
                  className={`data-table-row data-table-documents data-table-button-row ${
                    selectedDocument?.id === document.id ? "data-table-button-row-active" : ""
                  }`}
                  key={document.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(document.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(document.id);
                    }
                  }}
                >
                  <strong>{document.title}</strong>
                  <span>
                    {document.document_type} · {document.file_type}
                  </span>
                  <span>{formatSize(document.size_bytes)}</span>
                  <span>{formatUploadedAt(document.uploaded_at)}</span>
                  <span className="document-action-pair">
                    <button
                      type="button"
                      className="inline-badge status-neutral button-reset"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(document.id);
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="inline-badge status-good button-reset"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDownload(document.id);
                      }}
                    >
                      Download
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="document-preview-card">
          <div className="workspace-card-header">
            <div>
              <span className="panel-label">Preview</span>
              <h3>{selectedDocument?.title ?? "No document selected"}</h3>
            </div>
            {selectedDocument ? (
              <span className="inline-badge status-neutral">{selectedDocument.file_type}</span>
            ) : null}
          </div>

          {selectedDocument ? (
            <>
              <div className="key-value-grid document-preview-meta">
                <div className="key-value-item">
                  <span>Uploaded by</span>
                  <strong>{selectedDocument.uploaded_by}</strong>
                </div>
                <div className="key-value-item">
                  <span>Audience</span>
                  <strong>{selectedDocument.audience}</strong>
                </div>
                <div className="key-value-item">
                  <span>Type</span>
                  <strong>{selectedDocument.document_type}</strong>
                </div>
                <div className="key-value-item">
                  <span>Uploaded</span>
                  <strong>{formatUploadedAt(selectedDocument.uploaded_at)}</strong>
                </div>
              </div>

              <div className="document-preview-surface">
                {buildPreviewSummary(selectedDocument).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <div className="button-strip" style={{ marginTop: "1rem" }}>
                  <button type="button" className="secondary-action button-reset" onClick={() => openPreview(selectedDocument.id)}>
                    Open preview
                  </button>
                  <button type="button" className="ghost-chip button-reset" onClick={() => openDownload(selectedDocument.id)}>
                    Download file
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p>No documents are available yet.</p>
          )}
        </aside>
      </div>

      <form className="document-upload-form" onSubmit={(e) => void handleUpload(e)}>
        <div className="workspace-card-header">
          <div>
            <span className="panel-label">Upload</span>
            <h3>Add a document as {roleLabel}</h3>
          </div>
        </div>
        <p style={{ margin: "0 0 1rem", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
          Files are saved to this client record. Supported types: PDF, JPG, PNG, DOCX (max 20 MB). You must choose a file before
          upload is enabled.
        </p>

        <div className="document-upload-grid">
          <label className="form-field">
            <span>Document title</span>
            <input
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Assessment report draft"
              type="text"
              value={title}
            />
          </label>

          <label className="form-field">
            <span>Document type</span>
            <select name="documentType" onChange={(event) => setDocumentType(event.target.value)} value={documentType}>
              <option>Clinical report</option>
              <option>Intake form</option>
              <option>Consent form</option>
              <option>Supporting document</option>
            </select>
          </label>

          <label className="form-field">
            <span>Audience</span>
            <select name="audience" onChange={(event) => setAudience(event.target.value as UploadAudience)} value={audience}>
              <option>Shared</option>
              <option>Admin only</option>
              <option>Clinician</option>
              <option>Client portal</option>
            </select>
          </label>

          <label className="form-field form-field-file">
            <span>Select file</span>
            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setPickedFile(f);
                setUploadErr(null);
              }}
            />
            {pickedFile ? (
              <small style={{ display: "block", marginTop: 6, color: "var(--muted)" }}>
                Selected: {pickedFile.name} ({formatSize(pickedFile.size)})
              </small>
            ) : null}
          </label>
        </div>

        {uploadErr ? (
          <p className="inline-badge status-warn" role="alert" style={{ marginBottom: "0.75rem" }}>
            {uploadErr}
          </p>
        ) : null}

        <div className="button-strip document-upload-actions">
          <button className="primary-action document-upload-submit" type="submit" disabled={!canSubmit}>
            {uploadBusy ? "Uploading…" : "Upload document"}
          </button>
          <button
            className="ghost-chip"
            disabled={uploadBusy}
            onClick={() => {
              setTitle("");
              setDocumentType("Clinical report");
              setAudience("Shared");
              setPickedFile(null);
              setUploadErr(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            type="button"
          >
            Reset fields
          </button>
        </div>
      </form>
    </div>
  );
}
