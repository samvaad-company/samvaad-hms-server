"use client";

/** Week view: a row per theatre, a column per day (Monday to Sunday), each cell listing that day's surgeries. */
import type { OtRecordDTO, OtRoomDTO } from "@/types/api";
import { addDays, dayLabel, hhmm, shortName, STATUS_STYLE, surgeryOf, todayLocal, type SlotRequest } from "@/components/ot/shared";

const SHOWN = 3;

export function WeekView({ monday, rooms, bookings, canWrite, onOpen, onBookSlot, onPickDay }: {
  monday: string;
  rooms: OtRoomDTO[];
  bookings: OtRecordDTO[];
  canWrite: boolean;
  onOpen: (b: OtRecordDTO) => void;
  onBookSlot: (s: SlotRequest) => void;
  /** Click a day heading to open that day. */
  onPickDay: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const week = bookings.filter((b) => b.scheduledDate >= days[0] && b.scheduledDate <= days[6] && b.status !== "Cancelled");
  const known = new Set(rooms.map((r) => r.name));
  const extra = [...new Set(week.filter((b) => b.otRoom && !known.has(b.otRoom)).map((b) => b.otRoom))];
  const rows = [...rooms.map((r) => ({ key: `r${r.id}`, id: r.id as number | null, name: r.name })), ...extra.map((n) => ({ key: `n${n}`, id: null, name: n }))];
  const today = todayLocal();

  return (
    <div className="overflow-x-auto p-5">
      <div className="min-w-[980px] rounded-[10px] border border-[color:var(--line)] overflow-hidden bg-[color:var(--surface)]">
        <div className="grid border-b border-[color:var(--line)]" style={{ gridTemplateColumns: "180px repeat(7, minmax(0, 1fr))" }}>
          <div />
          {days.map((d) => (
            <button key={d} type="button" onClick={() => onPickDay(d)}
              className={`border-l border-[color:var(--line)] py-2 text-center font-mono text-[13px] cursor-pointer hover:bg-[color:var(--subtle)] ${d === today ? "text-[color:var(--brand)] font-semibold" : "text-[color:var(--ink-soft)]"}`}>
              {dayLabel(d)}
            </button>
          ))}
        </div>
        {rows.map((room) => (
          <div key={room.key} className="grid border-b border-[color:var(--line)] last:border-b-0" style={{ gridTemplateColumns: "180px repeat(7, minmax(0, 1fr))" }}>
            <div className="px-3 py-4 text-[14px] font-medium text-[color:var(--ink)]">{room.name}</div>
            {days.map((d) => {
              const cell = week
                .filter((b) => b.scheduledDate === d && (room.id != null ? b.roomId === room.id || (b.roomId == null && b.otRoom === room.name) : b.otRoom === room.name))
                .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
              return (
                <div key={d} className={`group relative border-l border-[color:var(--line)] p-1 min-h-[68px] ${d === today ? "bg-[color:var(--brand-soft)]/30" : ""}`}>
                  {canWrite && cell.length === 0 && (
                    <button type="button" aria-label={`Book ${room.name} on ${dayLabel(d)}`} onClick={() => onBookSlot({ roomId: room.id, roomName: room.name, date: d, time: "09:00" })}
                      className="absolute inset-0 w-full cursor-pointer text-[12px] text-transparent hover:text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] transition-colors">+ Book</button>
                  )}
                  <div className="relative flex flex-col gap-1">
                    {cell.slice(0, SHOWN).map((b) => (
                      <button key={b.id} type="button" onClick={() => onOpen(b)} title={`${hhmm(b.startMinute ?? 0)} · ${surgeryOf(b)} · ${b.patientName} · ${b.surgeon}`}
                        className={`w-full rounded-[6px] border px-[6px] py-[3px] text-left cursor-pointer hover:brightness-95 ${STATUS_STYLE[b.status].block} ${b.caseType === "Emergency" ? "border-l-4 !border-l-[#e0001b]" : ""}`}>
                        <span className="block truncate text-[11px] leading-[14px]"><span className="font-mono">{b.startMinute != null ? hhmm(b.startMinute) : "--:--"}</span> {surgeryOf(b)}</span>
                        <span className="block truncate text-[11px] leading-[14px] opacity-80">{shortName(b.patientName)}</span>
                      </button>
                    ))}
                    {cell.length > SHOWN && (
                      <button type="button" onClick={() => onPickDay(d)} className="text-left text-[11px] text-[color:var(--brand)] hover:underline cursor-pointer">+{cell.length - SHOWN} more</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {rows.length === 0 && <p className="px-5 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No theatres yet — add them under Rooms.</p>}
      </div>
    </div>
  );
}
