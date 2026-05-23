import { ClientSlotBooking } from "../../../components/client-slot-booking";

export default function BookAssessmentPage({ params }: { params: { token: string } }) {
  return <ClientSlotBooking token={params.token} />;
}
