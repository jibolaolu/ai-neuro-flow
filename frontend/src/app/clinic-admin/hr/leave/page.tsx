import { HrPageShell } from "../HrPageShell";
import { HrLeaveContent } from "./HrLeaveContent";

export default function HrLeavePage() {
  return (
    <HrPageShell href="/clinic-admin/hr/leave" title="Leave & Absence" lead="Review and approve leave requests from clinical and administrative staff.">
      <HrLeaveContent isAdmin />
    </HrPageShell>
  );
}
