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
