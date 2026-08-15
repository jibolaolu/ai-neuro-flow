import { redirect } from "next/navigation";

/** This route no longer exists on NeuroFlow standalone — redirect to clinic admin. */
export default function LegacyIntegrationPage() {
  redirect("/clinic-admin");
}
