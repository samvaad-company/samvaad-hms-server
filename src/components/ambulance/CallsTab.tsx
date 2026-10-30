"use client";

import { useState } from "react";
import { useRowActions } from "@/lib/api/useRowActions";
import type { AmbulanceCallDTO } from "@/types/api";
import { dmy } from "@/components/mrd/shared";
import { CALL_STATUS, CALL_TYPES, Chip, hhmm, inr } from "./shared";

const FILTERS = ["All", "Queued", "Dispatched", "At scene", "Transporting", "Completed", "Cancelled"] as const;
const sel = "rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[7px] text-[13px]";

/** Every call, newest first: filter by step or type, search, and remove one. */
export function CallsTab({ calls, canWrite, reload }: { calls: AmbulanceCallDTO[]; canWrite: boolean; reload: () => void }) {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const actions = useRowActions("ambulance/calls", reload);
  const needle = q.trim().toLowerCase();
  const shown = [...calls].sort((a, b) => b.id - a.id).filter((c) => (status === "All" || c.status === status) && (!type || c.callType === type)
    && (!needle || [c.callNo, c.patientName, c.vehicleNumber, c.pickupLocation, c.dropLocation, c.driverName].some((s) => s.toLowerCase().includes(needle))));
  return (
    <div className="p-4">
      {actions.dialog}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Status" className="inline-flex flex-wrap rounded-[8px] bg-[color:var(--subtle-2)] p-[3px]">
          {FILTERS.map((s) => <button key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={`cursor-pointer rounded-[6px] px-3 py-[4px] text-[13px] ${status === s ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{s}</button>)}
        </div>
        <select aria-label="Call type" value={type} onChange={(e) => setType(e.target.value)} className={sel}><option value="">All types</option>{CALL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search call no., patient, vehicle or place…" aria-label="Search calls" className={`${sel} ml-auto w-[300px] max-w-full outline-none focus:border-[color:var(--brand)]`} />
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full min-w-[980px] border-collapse text-[13px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Call</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Patient</th><th className="px-4 py-2 font-medium">Route</th><th className="px-4 py-2 font-medium">Vehicle</th><th className="px-4 py-2 font-medium">Opened</th><th className="px-4 py-2 text-right font-medium">Fare</th><th className="px-4 py-2 font-medium">Status</th><th className="w-10" /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No calls match.</td></tr>}
            {shown.map((c) => (
              <tr key={c.id} className="border-t border-[color:var(--line)] align-top">
                <td className="whitespace-nowrap px-4 py-[10px] font-mono text-[12px] font-semibold">{c.callNo || `#${c.id}`}</td>
                <td className="px-4 py-[10px]">{c.callType}</td>
                <td className="px-4 py-[10px]">{c.patientName}{c.phone && <span className="block font-mono text-[11px] text-[color:var(--ink-soft)]">{c.phone}</span>}</td>
                <td className="max-w-[280px] px-4 py-[10px] text-[color:var(--ink-soft)]">{c.pickupLocation}{c.dropLocation && ` → ${c.dropLocation}`}</td>
                <td className="whitespace-nowrap px-4 py-[10px] font-mono text-[12px]">{c.vehicleNumber || "—"}{c.driverName && <span className="block font-sans text-[11px] text-[color:var(--ink-soft)]">{c.driverName}</span>}</td>
                <td className="whitespace-nowrap px-4 py-[10px] font-mono text-[12px]">{dmy(c.date)} <span className="text-[color:var(--ink-soft)]">{hhmm(c.openedAt)}</span></td>
                <td className="px-4 py-[10px] text-right font-mono">{c.amount > 0 ? inr(c.amount) : "—"}</td>
                <td className="px-4 py-[10px]"><Chip tone={CALL_STATUS[c.status].tone}>{CALL_STATUS[c.status].label}</Chip></td>
                <td className="px-2 py-[10px] text-right">{canWrite && <button aria-label={`Delete call ${c.callNo}`} className="cursor-pointer text-[12px] text-[color:var(--ink-soft)] hover:text-[#c8001a]" onClick={() => actions.remove(c.id, `call ${c.callNo || c.id}`)}>Delete</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">{shown.length} of {calls.length} calls</p>
    </div>
  );
}
