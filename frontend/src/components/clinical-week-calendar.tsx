"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AvailabilitySlot } from "../lib/availability-api";
import type { VenueFilterId } from "../lib/clinical-calendar-config";
import type { AssessmentBooking } from "../lib/calendar-types";

const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 21 * 60;
const SLOT_MINUTES = 30;
const ROWS = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoLocal(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseIsoLocal(iso: string): Date {
  const [yy, mm, dd] = iso.split("-").map(Number);
  return new Date(yy, mm - 1, dd);
}

function startOfWeekMonday(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatWeekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${monday.toLocaleDateString("en-GB", opts)} – ${sunday.toLocaleDateString("en-GB", opts)}`;
}

function minutesFromMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function rowFromMinutesFromDayStart(mins: number): number {
  return Math.floor((mins - DAY_START_MINUTES) / SLOT_MINUTES);
}

function rowsBetween(startMins: number, endMins: number): { topRow: number; rowSpan: number } {
  const topRow = Math.max(0, rowFromMinutesFromDayStart(startMins));
  const dur = Math.max(SLOT_MINUTES, endMins - startMins);
  const rowSpan = Math.min(ROWS - topRow, Math.max(1, Math.ceil(dur / SLOT_MINUTES)));
  return { topRow, rowSpan };
}

function bookingMatchesVenue(b: AssessmentBooking, venue: VenueFilterId): boolean {
  if (venue === "all") return true;
  const r = b.room.toLowerCase();
  const isOnline = /remote|online|right to choose|nhs online|zoom|teams/.test(r);
  if (venue === "online") return isOnline;
  if (venue === "clinic") return !isOnline;
  return true;
}

function bookingMatchesTypeFilter(
  b: AssessmentBooking,
  match: RegExp | undefined,
): boolean {
  if (!match) return true;
  return match.test(b.assessmentType);
}

type CreateSlotBody = { date_iso: string; start_time: string; end_time: string };

type ClinicalWeekCalendarProps = {
  availabilitySlots: AvailabilitySlot[];
  bookings: AssessmentBooking[];
  clinicianId: string;
  venueFilter: VenueFilterId;
  typeMatch?: RegExp;
  weekOffset: number;
  onWeekOffsetChange: (n: number) => void;
  onCreateSlot: (body: CreateSlotBody) => void | Promise<void>;
  onDeleteSlot: (slot: AvailabilitySlot) => void;
  saving?: boolean;
};

export function ClinicalWeekCalendar({
  availabilitySlots,
  bookings,
  clinicianId,
  venueFilter,
  typeMatch,
  weekOffset,
  onWeekOffsetChange,
  onCreateSlot,
  onDeleteSlot,
  saving = false,
}: ClinicalWeekCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const weekMonday = useMemo(() => {
    const base = addDays(startOfWeekMonday(today), weekOffset * 7);
    return base;
  }, [today, weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekMonday, i);
      return {
        date: isoLocal(d.getFullYear(), d.getMonth() + 1, d.getDate()),
        label: d.toLocaleDateString("en-GB", { weekday: "short" }),
        dayNum: d.getDate(),
        monthStr: d.toLocaleDateString("en-GB", { month: "short" }),
      };
    });
  }, [weekMonday]);

  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.clinicianId === clinicianId &&
          bookingMatchesVenue(b, venueFilter) &&
          bookingMatchesTypeFilter(b, typeMatch),
      ),
    [bookings, clinicianId, venueFilter, typeMatch],
  );

  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragStartRow, setDragStartRow] = useState<number | null>(null);
  const [dragEndRow, setDragEndRow] = useState<number | null>(null);
  const dragActive = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDateIso, setModalDateIso] = useState("");
  const [modalStartRow, setModalStartRow] = useState(0);
  const [modalEndRow, setModalEndRow] = useState(1);

  const dragSnapshot = useRef({ col: null as number | null, start: null as number | null, end: null as number | null });
  dragSnapshot.current = { col: dragCol, start: dragStartRow, end: dragEndRow };

  const rowLabels = useMemo(() => {
    const labels: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      const t = DAY_START_MINUTES + r * SLOT_MINUTES;
      const h = Math.floor(t / 60);
      const m = t % 60;
      labels.push(`${pad2(h)}:${pad2(m)}`);
    }
    return labels;
  }, []);

  const endDragCommit = useCallback(
    (col: number, start: number, end: number) => {
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      const dateIso = weekDays[col]?.date;
      if (!dateIso) return;
      setModalDateIso(dateIso);
      setModalStartRow(lo);
      setModalEndRow(hi);
      setModalOpen(true);
      setDragCol(null);
      setDragStartRow(null);
      setDragEndRow(null);
      dragActive.current = false;
    },
    [weekDays],
  );

  useEffect(() => {
    const onUp = () => {
      if (!dragActive.current) return;
      const { col, start, end } = dragSnapshot.current;
      if (col != null && start != null && end != null) {
        endDragCommit(col, start, end);
      }
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [endDragCommit]);

  const handlePointerDown = (col: number, row: number) => {
    dragActive.current = true;
    setDragCol(col);
    setDragStartRow(row);
    setDragEndRow(row);
  };

  const handlePointerEnter = (col: number, row: number) => {
    if (!dragActive.current || dragCol !== col || dragStartRow == null) return;
    setDragEndRow(row);
  };

  const slotBlocksForDate = (dateIso: string) =>
    availabilitySlots.filter((s) => s.date_iso === dateIso);

  const bookingBlocksForColumn = (dateIso: string) => {
    return filteredBookings.filter((b) => b.date === dateIso);
  };

  const confirmModal = async () => {
    const lo = Math.min(modalStartRow, modalEndRow);
    const hi = Math.max(modalStartRow, modalEndRow);
    const startMins = DAY_START_MINUTES + lo * SLOT_MINUTES;
    const endMins = DAY_START_MINUTES + (hi + 1) * SLOT_MINUTES;
    try {
      await Promise.resolve(
        onCreateSlot({
          date_iso: modalDateIso,
          start_time: `${pad2(Math.floor(startMins / 60))}:${pad2(startMins % 60)}`,
          end_time: `${pad2(Math.floor(endMins / 60))}:${pad2(endMins % 60)}`,
        }),
      );
      setModalOpen(false);
    } catch {
      /* parent sets loadError */
    }
  };

  return (
    <div className="clinical-week-wrap">
      <div className="clinical-week-toolbar">
        <div className="clinical-week-nav">
          <button
            type="button"
            className="ghost-chip button-reset"
            onClick={() => onWeekOffsetChange(weekOffset - 1)}
          >
            ← Previous week
          </button>
          <span className="clinical-week-range">{formatWeekRangeLabel(weekMonday)}</span>
          <button
            type="button"
            className="ghost-chip button-reset"
            onClick={() => onWeekOffsetChange(weekOffset + 1)}
          >
            Next week →
          </button>
          {weekOffset !== 0 ? (
            <button type="button" className="ghost-chip button-reset" onClick={() => onWeekOffsetChange(0)}>
              Today
            </button>
          ) : null}
        </div>
        <p className="clinical-week-hint muted">
          Drag across empty cells to add availability. NHS pathway labels apply when booking patients in admin -
          this grid saves your free slots only.
        </p>
      </div>

      <div className="clinical-week-scroll">
        <div className="clinical-week-grid">
          <div className="clinical-week-time-col">
            <div className="clinical-week-corner" aria-hidden />
            {rowLabels.map((lab, r) => (
              <div key={lab + r} className="clinical-week-time-label">
                {lab}
              </div>
            ))}
          </div>
          {weekDays.map((day, col) => {
            const slotsForDay = slotBlocksForDate(day.date);
            const booksForDay = bookingBlocksForColumn(day.date);
            return (
              <div key={day.date} className="clinical-week-day-col">
                <div className="clinical-week-day-head">
                  <span className="clinical-week-day-name">{day.label}</span>
                  <span className="clinical-week-day-num">
                    {day.dayNum} {day.monthStr}
                  </span>
                </div>
                <div className="clinical-week-day-body" role="presentation">
                  {Array.from({ length: ROWS }, (_, row) => {
                    const inDrag =
                      dragCol === col &&
                      dragStartRow != null &&
                      dragEndRow != null &&
                      row >= Math.min(dragStartRow, dragEndRow) &&
                      row <= Math.max(dragStartRow, dragEndRow);
                    return (
                      <button
                        key={row}
                        type="button"
                        className={`clinical-week-cell ${inDrag ? "clinical-week-cell-drag" : ""}`}
                        onPointerDown={() => handlePointerDown(col, row)}
                        onPointerEnter={() => handlePointerEnter(col, row)}
                        aria-label={`${day.label} ${day.date} ${rowLabels[row]}`}
                      />
                    );
                  })}
                  {slotsForDay.map((slot, idx) => {
                    const sm = minutesFromMidnight(slot.start_time);
                    const em = minutesFromMidnight(slot.end_time);
                    const { topRow, rowSpan } = rowsBetween(sm, em);
                    const pctTop = (topRow / ROWS) * 100;
                    const pctH = (rowSpan / ROWS) * 100;
                    const isBooked = slot.rota_status === "booked";
                    const confirmed = !isBooked && (slot.rota_status ?? "draft") === "confirmed";
                    return (
                      <div
                        key={`av-${idx}-${slot.start_time}`}
                        className={`clinical-week-block ${isBooked ? "clinical-week-block-booked" : `clinical-week-block-avail${confirmed ? " clinical-week-block-avail-confirmed" : ""}`}`}
                        style={{ top: `${pctTop}%`, height: `${pctH}%` }}
                        title={
                          isBooked
                            ? `Booked: ${slot.booked_client_name ?? "Client"}${slot.booked_client_pathway ? ` - ${slot.booked_client_pathway}` : ""}`
                            : confirmed
                            ? "Confirmed rota - contact Clinical Admin to change or remove"
                            : "Draft availability - you can remove until admin confirms the week"
                        }
                      >
                        <span className="clinical-week-block-label">
                          {slot.start_time}–{slot.end_time}
                          {isBooked ? " · Booked" : confirmed ? " · Confirmed" : ""}
                        </span>
                        {isBooked && slot.booked_client_name && (
                          <span className="clinical-week-block-label" style={{ fontSize: 10, opacity: 0.9, display: "block", marginTop: 2 }}>
                            {slot.booked_client_name}
                            {slot.booked_client_pathway ? ` - ${slot.booked_client_pathway}` : ""}
                          </span>
                        )}
                        {!confirmed && !isBooked ? (
                          <button
                            type="button"
                            className="clinical-week-block-remove"
                            onClick={() => onDeleteSlot(slot)}
                            aria-label="Remove availability slot"
                          >
                            x
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {booksForDay.map((b) => {
                    const sm = minutesFromMidnight(b.start);
                    const em = minutesFromMidnight(b.end);
                    const { topRow, rowSpan } = rowsBetween(sm, em);
                    const pctTop = (topRow / ROWS) * 100;
                    const pctH = (rowSpan / ROWS) * 100;
                    return (
                      <div
                        key={b.id}
                        className="clinical-week-block clinical-week-block-book clinical-week-block-book-passthrough"
                        style={{ top: `${pctTop}%`, height: `${pctH}%` }}
                      >
                        <span className="clinical-week-block-title">{b.clientName}</span>
                        <span className="clinical-week-block-sub">{b.assessmentType}</span>
                        <span className="clinical-week-block-sub muted">{b.room}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen ? (
        <div className="calendar-modal-backdrop" onClick={() => setModalOpen(false)} role="presentation">
          <div
            className="calendar-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm availability"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-card-header">
              <div>
                <span className="panel-label">Availability</span>
                <h2 style={{ margin: 0 }}>
                  {parseIsoLocal(modalDateIso).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
              </div>
              <button type="button" className="ghost-chip button-reset" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
            <p style={{ marginTop: "0.5rem" }}>
              <strong>
                {rowLabels[Math.min(modalStartRow, modalEndRow)]} –{" "}
                {(() => {
                  const hi = Math.max(modalStartRow, modalEndRow);
                  const endMins = DAY_START_MINUTES + (hi + 1) * SLOT_MINUTES;
                  return `${pad2(Math.floor(endMins / 60))}:${pad2(endMins % 60)}`;
                })()}
              </strong>
            </p>
            <div className="button-strip" style={{ marginTop: "1rem" }}>
              <button type="button" className="ghost-chip button-reset" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary-action button-reset" disabled={saving} onClick={() => void confirmModal()}>
                {saving ? "Saving…" : "Save availability"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
