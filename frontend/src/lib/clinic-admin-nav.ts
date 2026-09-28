export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export function getClinicAdminNav(activeHref: string): AdminNavGroup[] {
  return [
    {
      label: "Operations",
      items: [
        { href: "/clinic-admin", label: "Dashboard", icon: "DB", active: activeHref === "/clinic-admin" },
        { href: "/clinic-admin/calendar", label: "Calendar", icon: "CA", active: activeHref === "/clinic-admin/calendar" },
        { href: "/clinic-admin/clients", label: "Clients", icon: "CL", active: activeHref.startsWith("/clinic-admin/clients") },
        { href: "/clinic-admin/waitlist", label: "Waitlist", icon: "WL2", active: activeHref.startsWith("/clinic-admin/waitlist") },
      ],
    },
    {
      label: "Team",
      items: [
        { href: "/clinic-admin/team", label: "Your team", icon: "TM", active: activeHref.startsWith("/clinic-admin/team") },
        {
          href: "/clinic-admin/assessments",
          label: "Assessments",
          icon: "AS",
          active: activeHref.startsWith("/clinic-admin/assessments"),
        },
      ],
    },
    {
      label: "Insights",
      items: [
        {
          href: "/clinic-admin/reports",
          label: "Reports",
          icon: "RP",
          active: activeHref.startsWith("/clinic-admin/reports"),
        },
        {
          href: "/clinic-admin/analytics",
          label: "Analytics",
          icon: "AN",
          active: activeHref.startsWith("/clinic-admin/analytics"),
        },
        {
          href: "/clinic-admin/nps",
          label: "NPS & Feedback",
          icon: "NP",
          active: activeHref.startsWith("/clinic-admin/nps"),
        },
      ],
    },
    {
      label: "NHS / Referrals",
      items: [
        {
          href: "/clinic-admin/referrals",
          label: "Right to Choose",
          icon: "RTC",
          active: activeHref.startsWith("/clinic-admin/referrals"),
        },
        {
          href: "/clinic-admin/triage",
          label: "Waiting List Triage",
          icon: "WL",
          active: activeHref.startsWith("/clinic-admin/triage"),
        },
        {
          href: "/clinic-admin/nhs-connect",
          label: "NHS / EMIS Connect",
          icon: "NHS",
          active: activeHref.startsWith("/clinic-admin/nhs-connect"),
        },
      ],
    },
    {
      label: "Clinical",
      items: [
        {
          href: "/clinic-admin/prescriptions",
          label: "Prescribing & Titration",
          icon: "Rx",
          active: activeHref.startsWith("/clinic-admin/prescriptions"),
        },
      ],
    },
    {
      label: "Governance",
      items: [
        {
          href: "/clinic-admin/compliance",
          label: "CQC Compliance",
          icon: "CQC",
          active: activeHref.startsWith("/clinic-admin/compliance"),
        },
        {
          href: "/clinic-admin/ig-workflow",
          label: "Caldicott / IG",
          icon: "IG",
          active: activeHref.startsWith("/clinic-admin/ig-workflow"),
        },
        {
          href: "/clinic-admin/audit-log",
          label: "Audit Log",
          icon: "AL",
          active: activeHref.startsWith("/clinic-admin/audit-log"),
        },
      ],
    },
    {
      label: "Finance",
      items: [
        {
          href: "/clinic-admin/finance",
          label: "Contractor invoices",
          icon: "FN",
          active: activeHref.startsWith("/clinic-admin/finance"),
        },
        {
          href: "/clinic-admin/invoices",
          label: "Client invoices",
          icon: "INV",
          active: activeHref.startsWith("/clinic-admin/invoices"),
        },
      ],
    },
    {
      label: "Communication",
      items: [
        { href: "/clinic-admin/newsfeed", label: "Newsfeed", icon: "NF", active: activeHref.startsWith("/clinic-admin/newsfeed") },
        { href: "/clinic-admin/messages", label: "Messages", icon: "MS", active: activeHref.startsWith("/clinic-admin/messages") },
        { href: "/clinic-admin/policies", label: "Policies", icon: "PL", active: activeHref.startsWith("/clinic-admin/policies") },
        { href: "/clinic-admin/comms/email-triage", label: "Email Triage", icon: "ET", active: activeHref.startsWith("/clinic-admin/comms/email-triage") },
      ],
    },
    {
      label: "HR",
      items: [
        { href: "/clinic-admin/hr/leave", label: "Leave & Absence", icon: "LV", active: activeHref.startsWith("/clinic-admin/hr/leave") },
        { href: "/clinic-admin/hr/timesheets", label: "Timesheets", icon: "TS", active: activeHref.startsWith("/clinic-admin/hr/timesheets") },
        { href: "/clinic-admin/hr/supervision", label: "Supervision", icon: "SV", active: activeHref.startsWith("/clinic-admin/hr/supervision") },
        { href: "/clinic-admin/hr/training", label: "Training", icon: "TR", active: activeHref.startsWith("/clinic-admin/hr/training") },
        { href: "/clinic-admin/hr/incidents", label: "Incidents", icon: "IR", active: activeHref.startsWith("/clinic-admin/hr/incidents") },
        { href: "/clinic-admin/hr/contracts", label: "Contracts", icon: "CT", active: activeHref.startsWith("/clinic-admin/hr/contracts") },
      ],
    },
    {
      label: "Workspace",
      items: [
        {
          href: "/clinic-admin/subscription",
          label: "Subscription",
          icon: "SB",
          active: activeHref.startsWith("/clinic-admin/subscription"),
        },
        { href: "/clinic-admin/settings", label: "Settings", icon: "ST", active: activeHref.startsWith("/clinic-admin/settings") },
        { href: "/clinic-admin/support", label: "Support", icon: "SP", active: activeHref.startsWith("/clinic-admin/support") },
      ],
    },
  ];
}
