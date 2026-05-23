"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AvailabilitySlot } from "../lib/availability-api";
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchMyAvailability,
} from "../lib/availability-api";
import {
  APPOINTMENT_TYPE_OPTIONS,
  CLINICAL_VENUE_FILTERS,
  type VenueFilterId,
} from "../lib/clinical-calendar-config";
import type { AssessmentBooking } from "../lib/calendar-types";
import { ClinicalWeekCalendar } from "./clinical-week-calendar";

/* ── SVG icons ───────────────────────────────────────────────────────────── */
function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 1a5 5 0 0 1 5 5c0 3.5-5 9-5 9S3 9.5 3 6a5 5 0 0 1 5-5z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

type MonthDay = { key: string; inMonth: boolean; label: string; date: string };

function buildMonthGrid(year: number, monthIndex: number): MonthDay[] {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const padDays = (startWeekday + 6) % 7;
  const cells: MonthDay[] = [];
  const prevMonthLast = new Date(year, monthIndex, 0).getDate();
  const prevYear = monthIndex === 0 ? year - 1 : year;
  const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
  for (let i = padDays; i > 0; i -= 1) {
    const d = prevMonthLast - i + 1;
    cells.push({
      key: `pad-${prevYear}-${prevMonth}-${d}`,
      inMonth: false,
      label: String(d),
      date: isoDate(prevYear, prevMonth + 1, d),
    });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({
      key: `in-${year}-${monthIndex}-${d}`,
      inMonth: true,
      label: String(d),
      date: isoDate(year, monthIndex + 1, d),
    });
  }
  let tail = 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push({
      key: `tail-${nextYear}-${nextMonth}-${tail}`,
      inMonth: false,
      label: String(tail),
      date: isoDate(nextYear, nextMonth + 1, tail),
    });
    tail += 1;
  }
  return cells;
}

function slotsForDate(slots: AvailabilitySlot[], dateIso: string): AvailabilitySlot[] {
  return slots.filter((s) => s.date_iso === dateIso);
}

export function ClinicianAvailabilityEditor({
  assignedBookings,
  clinicianId,
}: {
  /** Assessments allocated to this clinician - shown on the same calendar. */
  assignedBookings: AssessmentBooking[];
  /** Matches `clinicianId` on mock bookings / roster row when filtering week columns. */
  clinicianId: string;
}) {
  const today = new Date();
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [venueFilter, setVenueFilter] = useState<VenueFilterId>("all");
  const [appointmentType, setAppointmentType] = useState("");
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [saving, setSaving] = useState(false);

  const typeMatch = useMemo(() => {
    const opt = APPOINTMENT_TYPE_OPTIONS.find((o) => o.value === appointmentType);
    return opt?.match;
  }, [appointmentType]);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const items = await fetchMyAvailability();
      setSlots(items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load availability");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthDays = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);

  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const rotaBanner = useMemo(() => {
    const confirmed = slots.filter((s) => s.rota_status === "confirmed");
    if (confirmed.length === 0) return null;
    const weeks = [...new Set(confirmed.map((s) => s.week_id).filter(Boolean))];
    return `Weekly rota confirmed for: ${weeks.join(", ")}. You will receive notifications when new weeks are signed off by admin.`;
  }, [slots]);

  const bookingsByDate = useMemo(() => {
    const m: Record<string, AssessmentBooking[]> = {};
    for (const b of assignedBookings) {
      if (!m[b.date]) m[b.date] = [];
      m[b.date].push(b);
    }
    return m;
  }, [assignedBookings]);

  async function submitSlot() {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await createAvailabilitySlot({
        date_iso: selectedDate,
        start_time: startTime,
        end_time: endTime,
      });
      setSelectedDate("");
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not save slot");
    } finally {
      setSaving(false);
    }
  }

  async function weekCreate(body: { date_iso: string; start_time: string; end_time: string }) {
    setSaving(true);
    try {
      await createAvailabilitySlot(body);
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not save slot");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(id: string) {
    try {
      await deleteAvailabilitySlot(id);
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not remove slot");
    }
  }

  async function weekDelete(slot: AvailabilitySlot) {
    await removeSlot(slot.id);
  }

  const selectedDayLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="calendar-layout">
      {rotaBanner ? (
        <div className="detail-callout" style={{ borderColor: "var(--success-100)", background: "var(--success-50)" }}>
          <strong>Rota update</strong>
          <p style={{ margin: "6px 0 0", color: "var(--ink)" }}>{rotaBanner}</p>
        </div>
      ) : null}

      {loadError ? (
        <p className="inline-badge status-warn" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="cav-toolbar">

        {/* ── View tabs ── */}
        <div className="cav-view-tabs" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            aria-selected={calendarView === "week"}
            className={`cav-view-tab button-reset${calendarView === "week" ? " cav-view-tab--active" : ""}`}
            onClick={() => setCalendarView("week")}
          >
            Week view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={calendarView === "month"}
            className={`cav-view-tab button-reset${calendarView === "month" ? " cav-view-tab--active" : ""}`}
            onClick={() => setCalendarView("month")}
          >
            Month view
          </button>
        </div>

        {calendarView === "week" ? (
          <>
            <div className="cav-toolbar-divider" aria-hidden />
            <div className="cav-filters-row">

              {/* Venue filter */}
              <div className="cav-filter-field">
                <span className="cav-filter-label">
                  <LocationIcon />
                  Venue
                </span>
                <div className="cav-venue-group" role="group" aria-label="Venue filter">
                  {CLINICAL_VENUE_FILTERS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`cav-venue-btn button-reset${venueFilter === v.id ? " cav-venue-btn--active" : ""}`}
                      onClick={() => setVenueFilter(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cav-filter-divider" aria-hidden />

              {/* Appointment type */}
              <div className="cav-filter-field cav-filter-field--select">
                <label htmlFor="cav-appt-type" className="cav-filter-label">
                  <FilterIcon />
                  Appointment type
                </label>
                <div className="cav-select-wrap">
                  <select
                    id="cav-appt-type"
                    className="cav-select"
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                  >
                    {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value || "all-types"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="cav-select-icon"><ChevronIcon /></span>
                </div>
              </div>

            </div>
          </>
        ) : null}

      </div>

      {calendarView === "week" ? (
        <ClinicalWeekCalendar
          availabilitySlots={slots}
          bookings={assignedBookings}
          clinicianId={clinicianId}
          venueFilter={venueFilter}
          typeMatch={typeMatch}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          onCreateSlot={weekCreate}
          onDeleteSlot={weekDelete}
          saving={saving}
        />
      ) : (
        <>
          <div className="cav-month-nav">
            <button
              className="cav-month-nav-btn button-reset"
              type="button"
              onClick={() => {
                if (monthIndex === 0) {
                  setMonthIndex(11);
                  setYear((y) => y - 1);
                } else {
                  setMonthIndex((m) => m - 1);
                }
              }}
            >
              ← Previous
            </button>
            <strong className="cav-month-label">{monthLabel}</strong>
            <button
              className="cav-month-nav-btn button-reset"
              type="button"
              onClick={() => {
                if (monthIndex === 11) {
                  setMonthIndex(0);
                  setYear((y) => y + 1);
                } else {
                  setMonthIndex((m) => m + 1);
                }
              }}
            >
              Next →
            </button>
          </div>

          <div className="calendar-month-shell">
            <div className="calendar-month-heading">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="calendar-month-grid">
              {monthDays.map((day) => {
                const daySlots = day.inMonth ? slotsForDate(slots, day.date) : [];
                const dayBookings = day.inMonth ? bookingsByDate[day.date] ?? [] : [];
                return (
                  <button
                    key={day.key}
                    type="button"
                    className={`calendar-month-day calendar-month-day-button ${day.inMonth ? "" : "calendar-month-day-muted"} ${
                      selectedDate === day.date ? "calendar-month-day-selected" : ""
                    }`}
                    disabled={!day.inMonth}
                    onClick={() => {
                      if (day.inMonth) setSelectedDate(day.date);
                    }}
                  >
                    {day.inMonth ? <span className="calendar-month-date">{day.label}</span> : null}
                    <div className="calendar-month-events">
                      {daySlots.map((s) => (
                        <span className="calendar-mini-event" key={s.id} style={{ cursor: "default", background: "var(--success)" }}>
                          <span className="calendar-mini-event-compact">
                            <strong>{s.start_time}</strong>
                            <small>Available</small>
                          </span>
                        </span>
                      ))}
                      {dayBookings.map((b) => (
                        <span className="calendar-mini-event" key={b.id} style={{ cursor: "default", background: "#4f46e5" }}>
                          <span className="calendar-mini-event-compact">
                            <strong>{b.start}</strong>
                            <small>{b.clientName}</small>
                          </span>
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Submitted Slots Summary Panel ─────────────────────────── */}
      {slots.length > 0 && (
        <div className="avail-summary-panel">
          <div className="avail-summary-header">
            <span className="panel-label">Your Availability</span>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Submitted slots</h3>
          </div>
          <div className="avail-summary-list">
            {slots
              .slice()
              .sort((a, b) => a.date_iso.localeCompare(b.date_iso) || a.start_time.localeCompare(b.start_time))
              .map((s) => {
                const isBooked = s.rota_status === "booked";
                const isConfirmed = !isBooked && s.rota_status === "confirmed";
                const dateObj = new Date(s.date_iso + "T12:00:00");
                const dateLabel = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={s.id} className="avail-slot-card">
                    <div className="avail-slot-card-icon">
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: isBooked
                            ? "linear-gradient(135deg,#7c5cfc 0%,#1d4ed8 100%)"
                            : isConfirmed
                            ? "linear-gradient(135deg,#1d4ed8 0%,#0ea5e9 100%)"
                            : "linear-gradient(135deg,#22a76a 0%,#16a34a 100%)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {isBooked ? "B" : isConfirmed ? "C" : "A"}
                      </div>
                    </div>
                    <div className="avail-slot-card-body">
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                        {dateLabel}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {s.start_time}–{s.end_time}
                      </div>
                      {isBooked && s.booked_client_name && (
                        <div style={{ fontSize: 11, color: "#7c5cfc", fontWeight: 600, marginTop: 2 }}>
                          {s.booked_client_name}
                          {s.booked_client_pathway ? ` · ${s.booked_client_pathway}` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span
                        className={`inline-badge ${isBooked ? "status-warn" : isConfirmed ? "status-good" : "status-neutral"}`}
                        style={{ fontSize: 10 }}
                      >
                        {isBooked ? "Booked" : isConfirmed ? "Confirmed" : "Draft"}
                      </span>
                      {!isConfirmed && !isBooked && (
                        <button
                          type="button"
                          className="ghost-chip button-reset"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => void removeSlot(s.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {selectedDate ? (
        <div className="calendar-modal-backdrop" onClick={() => setSelectedDate("")} role="presentation">
          <div
            className="calendar-booking-modal"
            role="dialog"
            aria-label="Add availability"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Availability</span>
                <h2>{selectedDayLabel}</h2>
              </div>
              <button type="button" className="ghost-chip button-reset" onClick={() => setSelectedDate("")}>
                Close
              </button>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 0 }}>
              Add the window when you can take assessments. Clinical Admin will use this list when assigning cases.
            </p>
            <div className="key-value-grid document-preview-meta" style={{ marginTop: "1rem" }}>
              <label className="key-value-item">
                <span>Start</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="key-value-item">
                <span>End</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
            <div className="button-strip" style={{ marginTop: "1rem" }}>
              <button type="button" className="primary-action button-reset" disabled={saving} onClick={() => void submitSlot()}>
                {saving ? "Saving…" : "Save availability"}
              </button>
            </div>
            {slotsForDate(slots, selectedDate).length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: 10 }}>Slots on this day</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {slotsForDate(slots, selectedDate).map((s) => {
                    const isBooked = s.rota_status === "booked";
                    const isConfirmed = !isBooked && s.rota_status === "confirmed";
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--muted-100)",
                          background: "var(--surface-50,rgba(0,0,0,0.02))",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isBooked
                              ? "linear-gradient(135deg,#7c5cfc 0%,#1d4ed8 100%)"
                              : isConfirmed
                              ? "linear-gradient(135deg,#1d4ed8 0%,#0ea5e9 100%)"
                              : "linear-gradient(135deg,#22a76a 0%,#16a34a 100%)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {isBooked ? "B" : isConfirmed ? "C" : "A"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {s.start_time}–{s.end_time}
                          </div>
                          {isBooked && s.booked_client_name && (
                            <div style={{ fontSize: 11, color: "#7c5cfc", marginTop: 2 }}>
                              {s.booked_client_name}
                            </div>
                          )}
                        </div>
                        <span
                          className={`inline-badge ${isBooked ? "status-warn" : isConfirmed ? "status-good" : "status-neutral"}`}
                          style={{ fontSize: 10 }}
                        >
                          {isBooked ? "Booked" : isConfirmed ? "Confirmed" : "Draft"}
                        </span>
                        {!isConfirmed && !isBooked && (
                          <button
                            type="button"
                            className="ghost-chip button-reset"
                            style={{ fontSize: 12 }}
                            onClick={() => void removeSlot(s.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
