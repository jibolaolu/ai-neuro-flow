import { ClientPortalSession } from "./ClientPortalSession";

export default function ClientPortalMessagesPage({ params }: { params: { token: string } }) {
  return <ClientPortalSession token={params.token} />;
}
