import { cookies } from "next/headers";

import { ClinicianAvailabilityEditor } from "../../../components/clinician-availability-editor";
import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import type { AssessmentBooking } from "../../../lib/calendar-types";
import { getClinicalStaffNav } from "../../../lib/clinical-staff-nav";
import { MOCK_ROLE_COOKIE } from "../../../lib/mock-auth";

export default async function ClinicianCalendarPage() {
  const cookieStore = await cookies();
  const staffRole =
    cookieStore.get(MOCK_ROLE_COOKIE)?.value === "senior-clinician" ? "senior-clinician" : "clinician";
  const assignedBookings: AssessmentBooking[] = [];
  const clinicianId = "";

  return (
    <RoleDashboardShell
      role={staffRole}
      roleLabel={staffRole === "senior-clinician" ? "Senior Clinician" : "Clinician"}
      sectionLabel="Availability"
      title="Calendar - availability and assigned assessments"
      navGroups={getClinicalStaffNav(staffRole, "/clinician/calendar")}
    >
      <div className="page-shell dashboard-page-shell compact-shell">
        <section className="page-hero compact-hero">
          <div className="page-hero-copy">
            <span className="eyebrow">Your calendar</span>
            <h1 className="page-lead-heading">Submit availability and see booked assessments.</h1>
            <p className="page-lead">
              Green blocks are slots you have offered. Indigo blocks are assessments already assigned to you. When admin
              confirms the weekly rota, confirmed slots are flagged and you receive an in-app notice (email integration can be
              enabled separately).
            </p>
          </div>
        </section>
        <ClinicianAvailabilityEditor assignedBookings={assignedBookings} clinicianId={clinicianId} />
      </div>
    </RoleDashboardShell>
  );
}
