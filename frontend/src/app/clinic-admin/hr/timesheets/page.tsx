import { HrPageShell } from "../HrPageShell";
import { HrTimesheetsContent } from "./HrTimesheetsContent";

export default function HrTimesheetsPage() {
  return (
    <HrPageShell href="/clinic-admin/hr/timesheets" title="Timesheets" lead="Review weekly timesheets submitted by clinical staff.">
      <HrTimesheetsContent isAdmin />
    </HrPageShell>
  );
}
