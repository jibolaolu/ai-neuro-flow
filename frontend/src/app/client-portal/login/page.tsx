import { Suspense } from "react";
import { ClientPortalLogin } from "./ClientPortalLogin";

export default function ClientPortalLoginPage() {
  return (
    <Suspense>
      <ClientPortalLogin />
    </Suspense>
  );
}
