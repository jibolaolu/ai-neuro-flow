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
      href: role === "senior-clinician" ? "/senior-clinician/newsfeed" : "/clinician/newsfeed",
      label: "Newsfeed",
      icon: "NF",
      active: activePath.includes("/newsfeed"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/messages" : "/clinician/messages",
      label: "Messages",
      icon: "MS",
      active: activePath.includes("/messages"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/policies" : "/clinician/policies",
      label: "Policies",
      icon: "PL",
      active: activePath.includes("/policies"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/hr/leave" : "/clinician/hr/leave",
      label: "Leave",
      icon: "LV",
      active: activePath.includes("/hr/leave"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/hr/timesheets" : "/clinician/hr/timesheets",
      label: "Timesheets",
      icon: "TS",
      active: activePath.includes("/hr/timesheets"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/hr/supervision" : "/clinician/availability",
      label: role === "senior-clinician" ? "Supervision" : "Availability",
      icon: role === "senior-clinician" ? "SV" : "AV",
      active: activePath.includes("/hr/supervision") || activePath.includes("/availability"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/hr/incidents" : "/clinician/hr/incidents",
      label: "Incidents",
      icon: "IR",
      active: activePath.includes("/hr/incidents"),
    },
    {
      href: role === "senior-clinician" ? "/senior-clinician/settings" : "/clinician/settings",
      label: "Account",
      icon: "AC",
      active: activePath.includes("/settings"),
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
