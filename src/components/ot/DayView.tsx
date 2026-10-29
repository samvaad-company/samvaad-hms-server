"use client";

/**
 * Day view: a row per theatre, a column per hour. Each surgery is a block placed by its start and length
 * (surgeries that overlap — only possible when overlap was allowed — stack in lanes). Click a block to open it,
 * click an empty hour to book that theatre at that time.
 */
import type { OtRecordDTO, OtRoomDTO } from "@/types/api";
import { hhmm, shortName, STATUS_STYLE, surgeryOf, type SlotRequest } from "@/components/ot/shared";

const LABEL_W = 210;
const LANE_H = 44;

/** The hours the grid shows: 07–19 by default, widened if a surgery starts earlier or runs later. */
function hourRange(bookings: OtRecordDTO[]): [number, number] {
  let from = 7;
  let to = 19;
  for (const b of bookings) {
    if (b.startMinute == null || b.endMinute == null) continue;
    from = Math.min(from, Math.floor(b.startMinute / 60));
    to = Math.max(to, Math.min(23, Math.ceil(b.endMinute / 60) - 1));
  }
  return [from, to];
}

/** Assign overlapping surgeries to separate lanes. */
function lanes(rows: OtRecordDTO[]): { b: OtRecordDTO; lane: number }[] {
  const ends: number[] = [];
  return [...rows].sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0)).map((b) => {
    let lane = ends.findIndex((e) => e <= (b.startMinute ?? 0));
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = b.endMinute ?? 0;
    return { b, lane };
  });
}

export function DayView({ date, rooms, bookings, canWrite, onOpen, onBookSlot }: {
  date: string;
  rooms: OtRoomDTO[];
  bookings: OtRecordDTO[];
  canWrite: boolean;
  onOpen: (b: OtRecordDTO) => void;
  onBookSlot: (s: SlotRequest) => void;
}) {
  const day = bookings.filter((b) => b.scheduledDate === date && b.status !== "Cancelled");
  const [from, to] = hourRange(day);
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const total = hours.length * 60;

  // A surgery in a theatre that isn't (or is no longer) on the rooms list still deserves a row.
  const known = new Set(rooms.map((r) => r.name));
  const extra = [...new Set(day.filter((b) => !known.has(b.otRoom) && b.otRoom).map((b) => b.otRoom))];
  const rows: { key: string; id: number | null; name: string }[] = [
    ...rooms.map((r) => ({ key: `r${r.id}`, id: r.id, name: r.name })),
    ...extra.map((n) => ({ key: `n${n}`, id: null, name: n })),
  ];

  return (
    <div className="overflow-x-auto p-5">
      <div className="min-w-[900px] rounded-[10px] border border-[color:var(--line)] overflow-hidden bg-[color:var(--surface)]">
        <div className="flex border-b border-[color:var(--line)]">
          <div style={{ width: LABEL_W }} className="shrink-0 border-r border-[color:var(--line)]" />
          <div className="relative flex-1 flex">
            {hours.map((h) => (
              <div key={h} className="flex-1 border-r border-[color:var(--line)] last:border-r-0 py-2 text-center font-mono text-[13px] text-[color:var(--ink-soft)]">{String(h).padStart(2, "0")}</div>
            ))}
          </div>
        </div>

        {rows.map((room) => {
          const mine = lanes(day.filter((b) => (room.id != null ? b.roomId === room.id || (b.roomId == null && b.otRoom === room.name) : b.otRoom === room.name) && b.startMinute != null));
          const laneCount = Math.max(1, ...mine.map((m) => m.lane + 1));
          const height = Math.max(laneCount * LANE_H + 12, 88);
          return (
            <div key={room.key} className="flex border-b border-[color:var(--line)] last:border-b-0" style={{ minHeight: height }}>
              <div style={{ width: LABEL_W }} className="shrink-0 border-r border-[color:var(--line)] px-3 py-3 text-[14px] font-medium text-[color:var(--ink)]">{room.name}</div>
              <div className="relative flex-1" style={{ height }}>
                <div className="absolute inset-0 flex">
                  {hours.map((h) => (
                    <button key={h} type="button" disabled={!canWrite} aria-label={`Book ${room.name} at ${String(h).padStart(2, "0")}:00`}
                      onClick={() => onBookSlot({ roomId: room.id, roomName: room.name, date, time: `${String(h).padStart(2, "0")}:00` })}
                      className={`flex-1 border-r border-[color:var(--line)] last:border-r-0 ${canWrite ? "hover:bg-[color:var(--subtle)] cursor-pointer" : "cursor-default"} transition-colors`} />
                  ))}
                </div>
                {mine.map(({ b, lane }) => {
                  const start = (b.startMinute ?? 0) - from * 60;
                  const left = (Math.max(0, start) / total) * 100;
                  const width = (Math.min(total, start + b.durationMin) - Math.max(0, start)) / total * 100;
                  return (
                    <button key={b.id} type="button" onClick={() => onOpen(b)}
                      title={`${hhmm(b.startMinute ?? 0)}–${hhmm(b.endMinute ?? 0)} · ${surgeryOf(b)} · ${b.patientName} · ${b.surgeon}`}
                      className={`absolute overflow-hidden rounded-[8px] border px-2 py-1 text-left cursor-pointer hover:brightness-95 ${STATUS_STYLE[b.status].block} ${b.caseType === "Emergency" ? "border-l-4 !border-l-[#e0001b]" : ""}`}
                      style={{ left: `${left}%`, width: `calc(${Math.max(width, 2)}% - 2px)`, top: 6 + lane * LANE_H, height: LANE_H - 4 }}>
                      <span className="block truncate font-mono text-[11px] leading-[14px]">{hhmm(b.startMinute ?? 0)}–{hhmm(b.endMinute ?? 0)}</span>
                      <span className="block truncate text-[12px] font-medium leading-[15px]">{surgeryOf(b)} · {shortName(b.patientName)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="px-5 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No theatres yet — add them under Rooms.</p>}
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Blocks show the surgery only; each theatre is also held for a turnaround after it. {canWrite ? "Click an empty hour to book." : ""}</p>
    </div>
  );
}
