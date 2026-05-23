import { redirect } from "next/navigation";

/** Legacy URL - matches Clinical Partners style “Appointments” hub. */
export default function ClinicianAssessmentsRedirectPage() {
  redirect("/clinician/appointments");
}
