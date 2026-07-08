"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (dismissed) { setDismissed(true); return; }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!deferredPrompt || dismissed || installed) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="pwa-install-banner" role="status" aria-live="polite">
      <div className="pwa-install-icon" aria-hidden>📱</div>
      <div className="pwa-install-text">
        <strong>Install Neuro Flow</strong>
        <span>Add to your home screen for faster access</span>
      </div>
      <button className="pwa-install-btn" onClick={() => { void handleInstall(); }}>
        Install
      </button>
      <button className="pwa-dismiss-btn" aria-label="Dismiss" onClick={handleDismiss}>
        ✕
      </button>
    </div>
  );
}
