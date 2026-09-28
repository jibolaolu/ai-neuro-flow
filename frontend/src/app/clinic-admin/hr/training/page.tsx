import { HrPageShell } from "../HrPageShell";
import { HrTrainingContent } from "./HrTrainingContent";

export default function HrTrainingPage() {
  return (
    <HrPageShell href="/clinic-admin/hr/training" title="Training" lead="Monitor mandatory and optional training records for all staff.">
      <HrTrainingContent isAdmin />
    </HrPageShell>
  );
}
