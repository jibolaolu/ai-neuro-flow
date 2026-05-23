/** Neuro Flow product branding — align with backend PLATFORM_* env vars in production. */

export const BRAND = {
  name: "Neuro Flow",
  tagline: "NICE-aligned neurodevelopmental assessment for clinics",
  supportEmail: "support@neuroflow.app",
  slug: "neuro_flow",
} as const;

export function brandConsentText(template: string): string {
  return template.replace(/Neuro Access|NeuroAccess|EverythingADHD/gi, BRAND.name);
}
