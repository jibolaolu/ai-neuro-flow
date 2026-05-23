"use client";

import { Suspense } from "react";

import { ClinicSubscriptionPanel } from "./clinic-subscription-panel";

export function ClinicSubscriptionPanelLazy(props: { compact?: boolean }) {
  return (
    <Suspense fallback={<article className="mini-card"><p>Loading subscription…</p></article>}>
      <ClinicSubscriptionPanel {...props} />
    </Suspense>
  );
}
