"use client";

import { useState } from "react";
import { browserApiUrl } from "../lib/get-api-base";

type CalendarLinks = { google?: string; outlook?: string; ical_path?: string };

export function CalendarSyncButtons({ clientId, icalPath }: { clientId: string; icalPath?: string }) {
  const [loading, setLoading] = useState(false);

  async function openLink(type: "google" | "outlook") {
    setLoading(true);
    try {
      const r = await fetch(browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/calendar-links`), {
        credentials: "include",
      });
      const d = (await r.json()) as CalendarLinks;
      const url = type === "google" ? d.google : d.outlook;
      if (url) window.open(url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a
        href={icalPath ?? browserApiUrl(`/api/v1/clients/${encodeURIComponent(clientId)}/calendar.ics`)}
        download="appointment.ics"
        className="ghost-chip"
        style={{ fontSize: 12 }}
      >
        Download .ics
      </a>
      <button
        type="button"
        className="ghost-chip button-reset"
        style={{ fontSize: 12 }}
        disabled={loading}
        onClick={() => void openLink("google")}
      >
        + Google Calendar
      </button>
      <button
        type="button"
        className="ghost-chip button-reset"
        style={{ fontSize: 12 }}
        disabled={loading}
        onClick={() => void openLink("outlook")}
      >
        + Outlook
      </button>
    </div>
  );
}
