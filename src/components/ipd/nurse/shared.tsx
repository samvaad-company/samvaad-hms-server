"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { IpdLiveDTO, IpdRecordDTO } from "@/types/api";

/** An admitted patient with their live state, as every nurse-station tab sees them. */
export interface WardPatient {
  adm: IpdRecordDTO;
  live: IpdLiveDTO | undefined;
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "2:30 PM" for today, "Thu, 8 Oct, 2:30 PM" for any other day. */
export function when(iso: string): string {
  const d = new Date(iso);
  return sameDay(d, new Date())
    ? clock(iso)
    : `${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, ${clock(iso)}`;
}

/** Re-run `fn` on an interval so the board stays live without a refresh. */
export function useAutoRefresh(fn: () => void, ms = 30_000) {
  const latest = useRef(fn);
  useEffect(() => { latest.current = fn; });
  useEffect(() => {
    const t = setInterval(() => latest.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Await a mutation and report whether it went through — the hook has already put the error on screen, so a failure just stops the caller. */
export async function done(p: Promise<unknown>): Promise<boolean> {
  try { await p; return true; } catch { return false; }
}

export const btn = {
  base: "inline-flex items-center justify-center gap-[6px] h-[30px] rounded-[8px] px-3 text-[12px] font-medium whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]",
  solid: "bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]",
} as const;

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-14 text-center text-[14px] text-[color:var(--ink-soft)]">{children}</div>;
}

/** Bed / ward, then the patient — the two-line identity every list in here starts with. */
export function PatientCell({ adm }: { adm: IpdRecordDTO }) {
  return (
    <div className="min-w-0 leading-[18px]">
      <p className="truncate text-[14px] font-semibold text-[color:var(--ink)]">
        {adm.patientName}
        {adm.isMlc && <span className="ml-2 rounded-full border border-[#f4a3ac] bg-[#ffe3e5] px-[6px] text-[10px] font-semibold text-[#b3001b]">MLC</span>}
      </p>
      <p className="truncate text-[12px] text-[color:var(--ink-soft)]">
        <span className="font-mono">{adm.bed || "No bed"}</span>
        {adm.ward ? ` · ${adm.ward}` : ""}
        {adm.patientId ? ` · ${adm.patientId}` : ""}
      </p>
    </div>
  );
}

export const sectionTitle = "text-[13px] font-semibold text-[color:var(--ink)]";
export const cardCls = "rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]";
export const inputCls =
  "h-[32px] w-full rounded-[8px] bg-[color:var(--surface)] border border-[color:var(--line)] px-2 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]";
