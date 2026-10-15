"use client";

/**
 * The day's appointments laid out one column per doctor, one row per hour (a calendar-style board).
 * The panel has a fixed height and scrolls inside itself, with the doctor names and the hour labels
 * pinned. Click an appointment to select it (the page opens its details in the side panel).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toIsoDate, todayIso } from "@/lib/dates";
import type { AppointmentDTO, DoctorDTO } from "@/types/api";

const DOCTOR_COLORS = ["#e11d48", "#1e293b", "#c026d3", "#0d9488", "#2563eb", "#d97706", "#7c3aed", "#059669", "#db2777", "#0891b2"];
const START_HOUR = 9;
const END_HOUR = 20; // last row starts at 20:00 (so the day ends at 21:00)

const STATUS_STYLE: Record<string, { bar: string; bg: string }> = {
  Completed: { bar: "#00955c", bg: "#dffff3" },
  Today:     { bar: "#007cff", bg: "#d6eaff" },
  Upcoming:  { bar: "#ff9000", bg: "#fff2e0" },
  Cancelled: { bar: "#ff0004", bg: "#ffe9e9" },
};

/** "10:12 AM" → minutes since midnight, or null when it isn't a clock time. */
export function minutesOf(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + n));
};
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

interface Props {
  doctors: DoctorDTO[];
  appointments: AppointmentDTO[];
  /** The day shown, as yyyy-mm-dd. */
  date: string;
  onDateChange: (iso: string) => void;
  selectedId: number | null;
  onSelect: (appt: AppointmentDTO) => void;
}

export function DoctorDayGrid({ doctors, appointments, date, onDateChange, selectedId, onSelect }: Props) {
  const isToday = date === todayIso();
  const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1;

  const dayAppts = appointments.filter(a => toIsoDate(a.date) === date);
  const columns = doctors.filter(d => d.status !== "On Leave" || dayAppts.some(a => a.doctorId === d.id || a.doctor === d.name));
  const forDoctor = (d: DoctorDTO) => dayAppts.filter(a => a.doctorId === d.id || a.doctor === d.name);

  // Show every hour that has an appointment, even outside the usual 9–21 day.
  const minutes = dayAppts.map(a => minutesOf(a.time)).filter((m): m is number => m !== null);
  const firstHour = Math.min(START_HOUR, ...minutes.map(m => Math.floor(m / 60)));
  const lastHour = Math.max(END_HOUR, ...minutes.map(m => Math.floor(m / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const unscheduled = (d: DoctorDTO) => forDoctor(d).filter(a => minutesOf(a.time) === null);

  const template = `64px repeat(${Math.max(columns.length, 1)}, minmax(220px, 1fr))`;

  return (
    <div className="flex flex-col">
      {/* Date controls */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[color:var(--line)]">
        <button type="button" onClick={() => onDateChange(addDays(date, -1))} aria-label="Previous day"
          className="h-[30px] w-[30px] inline-flex items-center justify-center rounded-[8px] border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">
          <ChevronLeft size={15} />
        </button>
        <button type="button" onClick={() => onDateChange(todayIso())} disabled={isToday}
          className="h-[30px] px-4 rounded-[8px] border border-[color:var(--line)] text-[12px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] disabled:opacity-50 disabled:cursor-default cursor-pointer">
          Today
        </button>
        <button type="button" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day"
          className="h-[30px] w-[30px] inline-flex items-center justify-center rounded-[8px] border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">
          <ChevronRight size={15} />
        </button>
        <label className="relative ml-1 cursor-pointer">
          <span className="text-[14px] font-medium text-[color:var(--ink)]">{longDate(date)}</span>
          <input type="date" value={date} onChange={e => e.target.value && onDateChange(e.target.value)} aria-label="Pick a date"
            className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <span className="ml-auto text-[12px] text-[color:var(--ink-soft)]">
          {dayAppts.length} appointment{dayAppts.length === 1 ? "" : "s"} · {columns.length} doctor{columns.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Fixed-height board: scrolls inside, headers and hour labels stay put */}
      <div className="overflow-auto" style={{ height: "clamp(420px, calc(100vh - 330px), 860px)" }}>
        {columns.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No doctors to show.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: template, minWidth: 64 + columns.length * 220 }}>
            {/* header row */}
            <div className="sticky top-0 left-0 z-30 bg-[color:var(--surface)] border-b border-r border-[color:var(--line)]" />
            {columns.map((d, i) => (
              <div key={d.id} className="sticky top-0 z-20 bg-[color:var(--surface)] border-b border-r border-[color:var(--line)] px-3 py-[10px] flex items-center gap-2 min-w-0">
                <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: DOCTOR_COLORS[i % DOCTOR_COLORS.length] }} />
                <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{d.name}</span>
                <span className="ml-auto text-[11px] px-[7px] py-[1px] rounded-full bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)] font-medium">{forDoctor(d).length}</span>
              </div>
            ))}

            {/* hour rows */}
            {hours.map(h => {
              const isNow = isToday && nowMinutes >= h * 60 && nowMinutes < (h + 1) * 60;
              return (
                <HourRow key={h} hour={h} isNow={isNow} columns={columns}
                  cell={d => forDoctor(d).filter(a => { const m = minutesOf(a.time); return m !== null && Math.floor(m / 60) === h; }).sort((a, b) => (minutesOf(a.time) ?? 0) - (minutesOf(b.time) ?? 0))}
                  selectedId={selectedId} onSelect={onSelect} />
              );
            })}

            {/* anything without a clock time (e.g. "On arrival") */}
            {columns.some(d => unscheduled(d).length > 0) && (
              <>
                <div className="sticky left-0 z-10 bg-[color:var(--surface)] border-r border-b border-[color:var(--line)] px-2 pt-2 text-[10px] text-[color:var(--ink-soft)]">Any</div>
                {columns.map(d => (
                  <div key={d.id} className="border-r border-b border-[color:var(--line)] p-[6px] flex flex-col gap-[4px]">
                    {unscheduled(d).map(a => <Chip key={a.id} appt={a} selected={a.id === selectedId} onSelect={onSelect} />)}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HourRow({ hour, isNow, columns, cell, selectedId, onSelect }: {
  hour: number; isNow: boolean; columns: DoctorDTO[];
  cell: (d: DoctorDTO) => AppointmentDTO[]; selectedId: number | null; onSelect: (a: AppointmentDTO) => void;
}) {
  return (
    <>
      <div className={`sticky left-0 z-10 bg-[color:var(--surface)] border-r border-b border-[color:var(--line)] px-2 pt-2 text-[11px] font-mono ${isNow ? "text-[color:var(--brand)] font-medium" : "text-[color:var(--ink-soft)]"}`}>
        {String(hour).padStart(2, "0")}:00
      </div>
      {columns.map(d => {
        const items = cell(d);
        return (
          <div key={d.id} className={`border-r border-b border-[color:var(--line)] p-[6px] flex flex-col gap-[4px] min-h-[56px] ${isNow ? "bg-[color:var(--brand-soft)]/40" : ""}`}>
            {items.map(a => <Chip key={a.id} appt={a} selected={a.id === selectedId} onSelect={onSelect} />)}
          </div>
        );
      })}
    </>
  );
}

function Chip({ appt, selected, onSelect }: { appt: AppointmentDTO; selected: boolean; onSelect: (a: AppointmentDTO) => void }) {
  const st = STATUS_STYLE[appt.status] ?? STATUS_STYLE.Upcoming;
  return (
    <button type="button" onClick={() => onSelect(appt)} title={`${appt.patientName} · ${appt.time} · ${appt.status}`}
      className={`text-left rounded-[6px] pl-2 pr-2 py-[3px] border-l-[3px] w-full cursor-pointer transition-shadow hover:shadow-md ${selected ? "ring-2 ring-[color:var(--brand)]" : ""}`}
      style={{ background: st.bg, borderLeftColor: st.bar }}>
      <span className={`block text-[11px] font-medium leading-[14px] truncate ${appt.status === "Cancelled" ? "line-through opacity-70" : ""}`} style={{ color: st.bar }}>
        {appt.time} · {appt.type}
      </span>
      <span className={`block text-[12px] leading-[16px] text-[#11111c] truncate ${appt.status === "Cancelled" ? "line-through opacity-70" : ""}`}>{appt.patientName}</span>
    </button>
  );
}
