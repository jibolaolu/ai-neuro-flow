/** Reference-aligned labels - filters & dropdowns only (backend slot API unchanged). */

export const CLINICAL_VENUE_FILTERS = [
  { id: "all", label: "All venues" },
  { id: "online", label: "NHS Online - Right to Choose" },
  { id: "clinic", label: "Clinic rooms" },
] as const;

export type VenueFilterId = (typeof CLINICAL_VENUE_FILTERS)[number]["id"];

export const APPOINTMENT_TYPE_OPTIONS: { value: string; label: string; match?: RegExp }[] = [
  { value: "", label: "Please select an appointment type…" },
  {
    value: "nhs-adhd-online",
    label: "NHS ADHD Online - NHS Right to Choose (CAMHS & Adult pathways)",
    match: /adhd|camhs|adult|child/i,
  },
  {
    value: "nhs-feedback",
    label: "NHS Feedback - NHS Right to Choose",
    match: /feedback/i,
  },
  {
    value: "adult-adhd",
    label: "NHS Adult ADHD Assessment - Right to Choose",
    match: /adult.*adhd|adhd.*adult/i,
  },
  {
    value: "camhs-adhd",
    label: "NHS CAMHS ADHD Assessment - Right to Choose",
    match: /camhs|child/i,
  },
  {
    value: "autism",
    label: "Autism pathway",
    match: /autism/i,
  },
];
