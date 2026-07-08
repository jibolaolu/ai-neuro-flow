"use client";

import { useEffect, useState } from "react";
import { browserApiUrl } from "../lib/get-api-base";
import { haptic } from "../lib/haptics";

export function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);
    if (Notification.permission === "granted") {
      checkSubscription().then(setSubscribed);
    }
    const d = localStorage.getItem("nf-push-dismissed");
    if (d) setDismissed(true);
  }, []);

  async function checkSubscription(): Promise<boolean> {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }

  async function subscribe() {
    try {
      haptic("tap");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      // Use a dummy VAPID key if not configured — real deployment needs a real key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ?? "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await fetch(browserApiUrl("/api/v1/push/subscribe"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      setSubscribed(true);
      haptic("success");
    } catch {
      // Graceful — push not supported or key invalid in dev
    }
  }

  function dismiss() {
    localStorage.setItem("nf-push-dismissed", "1");
    setDismissed(true);
  }

  // Don't show if: already subscribed, denied, dismissed, not supported
  if (
    dismissed ||
    subscribed ||
    permission === "denied" ||
    !("Notification" in window) ||
    !("PushManager" in window)
  ) return null;

  return (
    <div className="push-prompt-banner" role="status" aria-live="polite">
      <span className="push-prompt-icon">🔔</span>
      <div className="push-prompt-text">
        <strong>Stay updated</strong>
        <span>Get alerts for new referrals and form submissions</span>
      </div>
      <button className="push-prompt-btn" onClick={() => { void subscribe(); }}>
        Enable
      </button>
      <button className="push-dismiss-btn" aria-label="Dismiss" onClick={dismiss}>✕</button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
}
