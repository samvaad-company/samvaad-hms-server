"use client";

import type { OtRecordDTO } from "@/types/api";

export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** yyyy-mm-dd plus n days, as a plain calendar date (never shifted by timezone). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The Monday of the week an ISO date falls in. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

const parts = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
/** "Mon, 19 Oct" */
export const dayLabel = (iso: string) => parts(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/^(\w+) (\d+)/, "$1, $2");
export const todayLocal = () => new Date().toLocaleDateString("en-CA");

export const STATUS_STYLE: Record<OtRecordDTO["status"], { block: string; pill: string }> = {
  Scheduled: { block: "bg-[#e8f1ff] border-[#b9d3ff] text-[#0a4a9e]", pill: "bg-[#e8f1ff] text-[#0a5fc4]" },
  "In Progress": { block: "bg-[#fff2d6] border-[#f3cf7d] text-[#7a4700]", pill: "bg-[#fff2d6] text-[#8a5300]" },
  Completed: { block: "bg-[#dffff3] border-[#9fe3c6] text-[#0b5f3a]", pill: "bg-[#dffff3] text-[#0b7a47]" },
  Cancelled: { block: "bg-[color:var(--subtle)] border-[color:var(--line)] text-[color:var(--ink-soft)] line-through", pill: "bg-[#ffe9e9] text-[#c8001a]" },
};

export const shortName = (full: string) => {
  const p = full.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : full;
};

export const btn = {
  base: "inline-flex items-center justify-center gap-2 h-[34px] rounded-[8px] px-3 text-[13px] whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]",
  solid: "bg-[color:var(--brand)] font-medium text-white hover:bg-[color:var(--brand-hover)]",
} as const;

/** What the user clicked an empty slot to book. */
export interface SlotRequest {
  roomId: number | null;
  roomName: string;
  date: string;
  time: string;
}

export const surgeryOf = (b: OtRecordDTO) => b.surgeryName || b.procedure;
