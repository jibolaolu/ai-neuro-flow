export type SuperAdminNavItem = {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
};

export type SuperAdminNavGroup = {
  label: string;
  items: SuperAdminNavItem[];
};

export function getSuperAdminNav(activeHref: string): SuperAdminNavGroup[] {
  return [
    {
      label: "Platform",
      items: [
        { href: "/super-admin", label: "Dashboard", icon: "CP", active: activeHref === "/super-admin" },
      ],
    },
    {
      label: "Subscribers",
      items: [
        { href: "/super-admin/subscribers", label: "All clinics", icon: "CL", active: activeHref.startsWith("/super-admin/subscribers") },
        { href: "/super-admin/trials", label: "Trials", icon: "TR", active: activeHref.startsWith("/super-admin/trials") },
        { href: "/super-admin/billing", label: "Billing", icon: "BI", active: activeHref.startsWith("/super-admin/billing") },
      ],
    },
    {
      label: "Infrastructure",
      items: [
        { href: "/super-admin/infrastructure", label: "Services", icon: "SV", active: activeHref.startsWith("/super-admin/infrastructure") },
        { href: "/super-admin/auth0", label: "Auth0", icon: "A0", active: activeHref.startsWith("/super-admin/auth0") },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/super-admin/alerts", label: "Alerts", icon: "AL", active: activeHref.startsWith("/super-admin/alerts") },
        { href: "/super-admin/logs", label: "Audit log", icon: "LG", active: activeHref.startsWith("/super-admin/logs") },
        { href: "/super-admin/tickets", label: "Support tickets", icon: "TK", active: activeHref.startsWith("/super-admin/tickets") },
      ],
    },
    {
      label: "Admin",
      items: [
        { href: "/super-admin/settings", label: "Settings", icon: "ST", active: activeHref.startsWith("/super-admin/settings") },
      ],
    },
  ];
}
