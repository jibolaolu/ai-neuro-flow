import { HrPageShell } from "../HrPageShell";
import { HrIncidentsContent } from "./HrIncidentsContent";

export default function HrIncidentsPage() {
  return (
    <HrPageShell href="/clinic-admin/hr/incidents" title="Incidents" lead="Review and manage workplace incident reports.">
      <HrIncidentsContent isAdmin />
    </HrPageShell>
  );
}
