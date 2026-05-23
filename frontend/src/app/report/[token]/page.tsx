/**
 * Public clinical report access page.
 *
 * Accessed via the 5-day token link emailed to the client/parent.
 * The PDF is served directly from the backend — this page just provides
 * a clean landing with instructions and an embedded/download link.
 *
 * Route: /report/[token]
 */

import { browserApiUrl } from "../../../lib/get-api-base";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata = {
  title: "Your Assessment Report – Neuro Flow",
  description: "Securely access your clinical assessment report from Neuro Flow.",
};

// ── Page component ────────────────────────────────────────────────────────────

export default function PublicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  // Build the direct PDF URL. browserApiUrl returns a root-relative path when
  // NEXT_PUBLIC_API_URL is unset (same-origin), or the full URL if configured.
  const pdfUrl = browserApiUrl(`/api/v1/clinical-reports/token/${encodeURIComponent(token)}/pdf`);

  return (
    <main className="public-report-shell">
      {/* Branding header */}
      <header className="public-report-header">
        <div className="public-report-brand">
          <span className="public-report-brand-mark" aria-hidden>N</span>
          <span className="public-report-brand-name">Neuro Flow</span>
        </div>
      </header>

      {/* Content card */}
      <div className="public-report-card">
        {/* Icon */}
        <div className="public-report-icon-wrap" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#eef2ff" />
            <path
              d="M12 10h10l8 8v12a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"
              stroke="#2a4db7"
              strokeWidth="1.8"
              fill="none"
              strokeLinejoin="round"
            />
            <path d="M22 10v8h8" stroke="#2a4db7" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
            <line x1="15" y1="22" x2="25" y2="22" stroke="#2a4db7" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="15" y1="26" x2="22" y2="26" stroke="#2a4db7" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="public-report-title">Your Assessment Report</h1>
        <p className="public-report-lead">
          A clinical assessment report has been securely prepared for you by your Neuro Flow clinician.
        </p>

        {/* Security note */}
        <div className="public-report-security-note">
          <span className="public-report-security-icon" aria-hidden>🔒</span>
          <p>
            This is a <strong>secure, time-limited link</strong>. It remains valid for <strong>5 days</strong> from the
            date the report was issued. After that, please contact Neuro Flow to request a new copy.
          </p>
        </div>

        {/* Action buttons */}
        <div className="public-report-actions">
          <a
            href={pdfUrl}
            className="primary-action public-report-download-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden>↓</span> View / Download Report (PDF)
          </a>
        </div>

        {/* Instructions */}
        <div className="public-report-instructions">
          <h2>Tips for accessing your report</h2>
          <ul>
            <li>
              <strong>On desktop:</strong> the PDF will open in your browser. Use your browser's save button
              (or <kbd>Ctrl+S</kbd> / <kbd>⌘S</kbd>) to save a copy.
            </li>
            <li>
              <strong>On mobile:</strong> tap the button above. Your device may ask you to choose an app to
              open the PDF (e.g. Adobe Acrobat, Files, or Books).
            </li>
            <li>
              <strong>Save a copy:</strong> we recommend saving the PDF to a secure location, as this link
              will expire in 5 days.
            </li>
          </ul>
        </div>

        {/* Sharing guidance */}
        <div className="public-report-sharing">
          <h2>Sharing your report</h2>
          <p>
            Your report contains confidential clinical information. You may share it with relevant
            professionals (e.g. your GP, employer, school or university) using the secure PDF.
            Do not forward this email link to others.
          </p>
        </div>

        {/* Footer */}
        <div className="public-report-footer">
          <p>
            Questions about your report? Contact us at{" "}
            <a href="mailto:support@neuroflow.app">support@neuroflow.app</a>.
          </p>
          <p className="public-report-legal">
            This report was prepared by a qualified Neuro Flow clinician and is intended solely
            for the named recipient. Neuro Flow is registered under the UK GDPR and Data Protection Act 2018.
          </p>
        </div>
      </div>
    </main>
  );
}
