import { redirect } from "next/navigation";

export default function ClientPortalRoot({ params }: { params: { token: string } }) {
  redirect(`/client-portal/${params.token}/messages`);
}
