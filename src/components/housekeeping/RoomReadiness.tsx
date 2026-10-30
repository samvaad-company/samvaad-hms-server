"use client";

import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import type { HkBoardDTO, HkRoomDTO } from "@/types/api";

const TONE: Record<HkRoomDTO["state"], string> = {
  Ready: "border-[#9fe3c6] bg-[#effff8] text-[#0b7a47]",
  Occupied: "border-[color:var(--line)] bg-[color:var(--subtle)] text-[color:var(--ink)]",
  Cleaning: "border-[#f1cf9b] bg-[#fff6e8] text-[#8a5300]",
  "To verify": "border-[#b9c6f3] bg-[#eef2ff] text-[#2c43a8]",
  Unavailable: "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink-soft)]",
};
const STATES: HkRoomDTO["state"][] = ["Ready", "Cleaning", "To verify", "Occupied", "Unavailable"];

/** Every bed by ward, coloured by whether it can take the next patient. */
export function RoomReadiness({ board }: { board: HkBoardDTO }) {
  const { run, error } = useMutation();
  const wards = [...new Set(board.rooms.map((r) => r.ward))];
  return (
    <div className="p-4">
      <p className="mb-3 flex flex-wrap items-center gap-3 text-[13px] text-[color:var(--ink-soft)]">
        <span className="font-mono"><b className="text-[color:var(--ink)]">{board.counts.ready}</b> of {board.counts.beds} beds ready</span>
        {STATES.map((s) => <span key={s} className="inline-flex items-center gap-[6px]"><span className={`inline-block h-[10px] w-[10px] rounded-[3px] border ${TONE[s]}`} />{s} <span className="font-mono">{board.rooms.filter((r) => r.state === s).length}</span></span>)}
      </p>
      {error && <p role="alert" className="mb-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      {wards.length === 0 && <p className="py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No beds are set up yet.</p>}
      {wards.map((w) => (
        <section key={w} className="mb-5">
          <h2 className="mb-2 text-[13px] font-semibold text-[color:var(--ink-soft)]">{w}</h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {board.rooms.filter((r) => r.ward === w).map((r) => (
              <div key={r.id} className={`rounded-[10px] border px-3 py-2 ${TONE[r.state]}`}>
                <p className="flex items-center justify-between text-[13px] font-semibold"><span>Bed {r.number}</span><span className="text-[11px] font-medium">{r.state}</span></p>
                <p className="min-h-[16px] truncate text-[12px] opacity-80">{r.state === "Occupied" ? r.patient : ""}</p>
                {r.state === "Ready" && <button className="mt-1 cursor-pointer text-[12px] font-medium underline" onClick={() => void run(() => api.post(`/housekeeping/beds/${r.id}/clean`)).catch(() => undefined)}>Send for cleaning</button>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
