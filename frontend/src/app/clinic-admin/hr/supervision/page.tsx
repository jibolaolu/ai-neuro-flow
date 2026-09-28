import { HrPageShell } from "../HrPageShell";
import { HrSupervisionContent } from "./HrSupervisionContent";

export default function HrSupervisionPage() {
  return (
    <HrPageShell href="/clinic-admin/hr/supervision" title="Supervision" lead="Track clinical supervision sessions and compliance.">
      <HrSupervisionContent isAdmin />
    </HrPageShell>
  );
}
