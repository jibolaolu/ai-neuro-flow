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
      label: "Finance",
      items: [
        {
          href: "/clinic-admin/finance",
          label: "Contractor invoices",
          icon: "FN",
          active: activeHref.startsWith("/clinic-admin/finance"),
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
