import type { AdminNavGroup } from "./clinic-admin-nav";

/**
 * Clinical Partners–style navigation for clinician + senior clinician.
 * Order matches CP reference: Home → Appointments → Patients → Reports → Calendar → Finance → Historical Statements.
 */
export function getClinicalStaffNav(
  role: "clinician" | "senior-clinician",
  activePath: string,
): AdminNavGroup[] {
  const dashHref = role === "senior-clinician" ? "/senior-clinician" : "/clinician";

  const appointmentsActive =
    activePath.startsWith("/clinician/appointments") || activePath.startsWith("/clinician/assessments");

  const reportsActive =
    activePath.startsWith("/clinician/reports") ||
    activePath.startsWith("/senior-clinician/report-review");

  const clinicalItems = [
    {
      href: dashHref,
      label: "Home",
      icon: "HM",
      active: activePath === dashHref || activePath === `${dashHref}/`,
    },
    {
      href: "/clinician/appointments",
      label: "Appointments",
      icon: "AP",
      active: appointmentsActive,
    },
    {
      href: "/clinician/clients",
      label: "Patients",
      icon: "PT",
      active: activePath.startsWith("/clinician/clients"),
    },
    {
      href: "/clinician/reports",
      label: "Reports",
      icon: "RP",
      active: reportsActive,
    },
    {
      href: "/clinician/calendar",
      label: "Calendar",
      icon: "CA",
      active: activePath.startsWith("/clinician/calendar"),
    },
    {
      href: "/clinician/finance",
      label: "Finance",
      icon: "FN",
      active: activePath.startsWith("/clinician/finance"),
    },
    {
      href: "/clinician/historical-statements",
      label: "Historical Statements",
      icon: "HS",
      active: activePath.startsWith("/clinician/historical-statements"),
    },
    {
      href: `${dashHref}/support`,
      label: "Support",
      icon: "SP",
      active: activePath.startsWith(`${dashHref}/support`) || activePath.startsWith("/clinician/support"),
    },
  ];

  return [{ label: "Menu", items: clinicalItems }];
}
