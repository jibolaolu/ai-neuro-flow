import Link from "next/link";

const TABS: { id: "upcoming" | "pending" | "history"; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "pending", label: "Pending" },
  { id: "history", label: "History" },
];

export function ClinicalAppointmentSubtabs({ active }: { active: "upcoming" | "pending" | "history" }) {
  return (
    <div className="clinical-subtab-row" role="tablist" aria-label="Appointment views">
      {TABS.map((t) => (
        <Link
          key={t.id}
          className={`clinical-subtab ${active === t.id ? "clinical-subtab-active" : ""}`}
          href={`/clinician/appointments?tab=${t.id}`}
          role="tab"
          aria-selected={active === t.id}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
