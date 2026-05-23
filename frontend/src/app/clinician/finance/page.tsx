import { cookies } from "next/headers";

import { ClinicianFinancePortal } from "../../../components/clinician-finance-portal";
import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../lib/mock-auth";

type TabKey = "timesheets" | "invoices" | "disbursements" | "submitted";

function parseTab(raw: string | undefined): TabKey {
  if (raw === "timesheets" || raw === "disbursements" || raw === "submitted") return raw;
  if (raw === "invoices") return "invoices";
  return "invoices";
}

export default async function ClinicianFinancePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const cookieStore = await cookies();
  const staffRole =
    cookieStore.get(MOCK_ROLE_COOKIE)?.value === "senior-clinician" ? "senior-clinician" : "clinician";
  const tab = parseTab(searchParams?.tab);

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
      sectionLabel="Finance"
      title="Finance"
      navGroups={getClinicalStaffNav(staffRole, "/clinician/finance")}
    >
      <div className="page-shell dashboard-page-shell compact-shell clinical-portal-page">
        <ClinicianFinancePortal initialTab={tab} />
      </div>
    </RoleDashboardShell>
  );
}
