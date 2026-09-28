/** Platform-level branding — set NEXT_PUBLIC_PLATFORM_NAME and NEXT_PUBLIC_SUPPORT_EMAIL in .env. */

export const BRAND = {
  name: process.env.NEXT_PUBLIC_PLATFORM_NAME || "Clinical Platform",
  tagline: process.env.NEXT_PUBLIC_PLATFORM_TAGLINE || "NICE-aligned neurodevelopmental assessment for clinics",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  slug: process.env.NEXT_PUBLIC_PLATFORM_SLUG || "clinical_platform",
} as const;

export function brandConsentText(template: string): string {
  return template.replace(/Neuro Access|NeuroAccess|EverythingADHD/gi, BRAND.name);
}
