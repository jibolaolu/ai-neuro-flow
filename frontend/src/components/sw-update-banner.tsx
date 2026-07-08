"use client";

import { useEffect, useState } from "react";

export function SwUpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r) return;
      setReg(r);

      // Already has a waiting SW
      if (r.waiting) { setShowUpdate(true); return; }

      // SW update found
      r.addEventListener("updatefound", () => {
        const newWorker = r.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        });
      });
    });
  }, []);

  function applyUpdate() {
    if (!reg?.waiting) { window.location.reload(); return; }
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    }, { once: true });
  }

  if (!showUpdate) return null;

  return (
    <div className="sw-update-banner" role="status" aria-live="polite">
      <span className="sw-update-icon">🔄</span>
      <span className="sw-update-text">Update available</span>
      <button className="sw-update-btn" onClick={applyUpdate}>
        Refresh
      </button>
    </div>
  );
}
