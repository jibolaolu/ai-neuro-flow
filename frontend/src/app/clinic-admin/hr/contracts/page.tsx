import { HrPageShell } from "../HrPageShell";
import { HrContractsContent } from "./HrContractsContent";

export default function HrContractsPage() {
  return (
    <HrPageShell href="/clinic-admin/hr/contracts" title="Contracts" lead="Manage employment contracts and documentation for all staff.">
      <HrContractsContent isAdmin />
    </HrPageShell>
  );
}
