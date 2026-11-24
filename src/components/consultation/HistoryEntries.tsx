"use client";

/**
 * The patient's history as a short list: each line is a type (allergy, addiction, remarks, how long…), the details and, if it matters,
 * since when. Used on the prescription and, optionally, when a patient is registered.
 */
import { Plus, X } from "lucide-react";
import type { HistoryEntry } from "@/types/consultation";

export const HISTORY_TYPES = ["Allergy", "Addiction", "Remarks", "Time", "Surgery", "Family", "Other"];

const field = "h-[34px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";

const HINT: Record<string, string> = {
  Allergy: "e.g. Penicillin, dust",
  Addiction: "e.g. Smoking 10 a day, tobacco",
  Remarks: "Anything worth remembering",
  Time: "e.g. Pain since morning, fever at night",
  Surgery: "e.g. Appendectomy",
  Family: "e.g. Father diabetic",
  Other: "Details",
};

export function HistoryEntries({ value, onChange, compact = false }: { value: HistoryEntry[]; onChange: (next: HistoryEntry[]) => void; compact?: boolean }) {
  const set = (i: number, p: Partial<HistoryEntry>) => onChange(value.map((e, k) => (k === i ? { ...e, ...p } : e)));
  return (
    <div className="flex flex-col gap-2">
      {value.map((e, i) => (
        <div key={i} className={`grid items-center gap-2 ${compact ? "grid-cols-[110px_minmax(0,1fr)_110px_24px]" : "grid-cols-[120px_minmax(0,1fr)_130px_24px]"}`}>
          <select aria-label="Type" value={HISTORY_TYPES.includes(e.type) ? e.type : "Other"} onChange={(ev) => set(i, { type: ev.target.value })} className={`${field} px-2`}>
            {HISTORY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input aria-label="Details" value={e.text} placeholder={HINT[e.type] ?? "Details"} onChange={(ev) => set(i, { text: ev.target.value })} className={field} />
          <input aria-label="Since when" value={e.since} placeholder="Since (optional)" onChange={(ev) => set(i, { since: ev.target.value })} className={field} />
          <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((_, k) => k !== i))} className="cursor-pointer text-[color:var(--ink-soft)] hover:text-[#ff0004]"><X size={14} /></button>
        </div>
      ))}
      <div>
        <button type="button" onClick={() => onChange([...value, { type: "Allergy", text: "", since: "" }])} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[color:var(--brand)] hover:underline">
          <Plus size={13} /> Add history
        </button>
      </div>
    </div>
  );
}
