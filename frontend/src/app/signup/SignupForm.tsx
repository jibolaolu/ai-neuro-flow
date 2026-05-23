"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signupOrganization } from "../../lib/organizations-api";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleClinicNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) {
      setSlug(slugify(e.target.value));
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      const result = await signupOrganization({
        organization_name: String(fd.get("organization_name") ?? "").trim(),
        slug: slug || slugify(String(fd.get("slug") ?? "")),
        admin_full_name: String(fd.get("admin_full_name") ?? "").trim(),
        admin_email: String(fd.get("admin_email") ?? "").trim(),
        admin_password: String(fd.get("admin_password") ?? ""),
      });

      if (result.auth0_login_required) {
        router.push("/login?registered=1");
        return;
      }

      if (result.access_token) {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: result.access_token,
            full_name: result.full_name,
            role: "clinic-admin",
          }),
        });
      }

      router.push(result.redirect_path || "/clinic-admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="su-form">

      {error && (
        <div className="su-error" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm-.75 7a.75.75 0 100-1.5.75.75 0 000 1.5z" />
          </svg>
          {error}
        </div>
      )}

      {/* Section 1 — Clinic */}
      <div className="su-section">
        <p className="su-section-title">Your clinic</p>

        <div className="su-field">
          <label htmlFor="su-org-name">Clinic / practice name</label>
          <input
            id="su-org-name"
            name="organization_name"
            required
            minLength={2}
            placeholder="Your clinic or practice name"
            onChange={handleClinicNameChange}
          />
        </div>

        <div className="su-field">
          <label htmlFor="su-slug">
            Workspace URL
            <span className="su-label-hint">auto-filled from clinic name</span>
          </label>
          <div className="su-slug-row">
            <span className="su-slug-prefix">neuroflow.app/</span>
            <input
              id="su-slug"
              name="slug"
              required
              pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
              placeholder="your-clinic-name"
            />
          </div>
          <small className="su-hint">Lowercase letters, numbers and hyphens only</small>
        </div>
      </div>

      <div className="su-sep" />

      {/* Section 2 — Admin account */}
      <div className="su-section">
        <p className="su-section-title">Your admin account</p>

        <div className="su-field">
          <label htmlFor="su-full-name">Full name</label>
          <input
            id="su-full-name"
            name="admin_full_name"
            required
            placeholder="Your full name"
          />
        </div>

        <div className="su-field">
          <label htmlFor="su-email">Work email</label>
          <input
            id="su-email"
            name="admin_email"
            type="email"
            required
            placeholder="jane@yourclinic.co.uk"
          />
        </div>

        <div className="su-field">
          <label htmlFor="su-password">
            Password
            <span className="su-label-hint">min. 8 characters</span>
          </label>
          <div className="su-pw-row">
            <input
              id="su-password"
              name="admin_password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="su-pw-toggle"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      <button className="su-submit" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="su-spinner" aria-hidden />
            Creating workspace…
          </>
        ) : (
          <>
            Start free trial
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" />
            </svg>
          </>
        )}
      </button>

      <p className="su-terms">
        By creating an account you agree to our{" "}
        <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
        {" "}GDPR-compliant · Data stored in the UK.
      </p>

    </form>
  );
}
