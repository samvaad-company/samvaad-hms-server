"use client";

/** Small helpers shared by the HR screens: dates, money, the staff picker list and the dialog save wrapper. */
import { useMemo } from "react";
import { useList, useMutation } from "@/lib/api/hooks";
import type { StaffDTO } from "@/types/api";
import { attempt } from "@/components/mrd/shared";

export { attempt };

export const addDaysIso = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The Monday on or before a date. */
export const weekStart = (iso: string): string => {
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysIso(iso, -dow);
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "October 2026" from "2026-10". */
export const monthLabel = (m: string): string => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? ""} ${m.slice(0, 4)}`;

export const shiftMonth = (m: string, delta: number): string => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};

export const weekdayOf = (iso: string): string => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const isWeekend = (iso: string): boolean => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;

/** ₹1,23,456 — whole rupees. */
export const rupees = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "07:00" → "7 am"; "23:30" → "11:30 pm". */
export function clock12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hh = h % 12 || 12;
  return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** Everyone on the books (not Inactive), by name. */
export function useActiveStaff(): StaffDTO[] {
  const { items } = useList<StaffDTO>("/staff", { all: true });
  return useMemo(() => items.filter((s) => s.status !== "Inactive").sort((a, b) => a.name.localeCompare(b.name)), [items]);
}

/** Shared shell for a dialog's save: close resets the error; `submit` runs the call and closes on success. */
export function useAction(onClose: () => void, onDone?: () => void) {
  const { run, loading, error, reset } = useMutation();
  const close = () => { reset(); onClose(); };
  const submit = async (call: () => Promise<unknown>) => { if (await attempt(run(call))) { onDone?.(); close(); } };
  return { loading, error, close, submit, run, reset };
}

/** A month or year stepper: ‹ October 2026 ›. */
export function Stepper({ label, onPrev, onNext, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  const btn = "h-[32px] w-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] text-[16px] leading-none text-[color:var(--ink)] hover:bg-[color:var(--subtle)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" aria-label="Previous" onClick={onPrev} className={btn}>‹</button>
      <span className="min-w-[132px] text-center text-[14px] font-medium text-[color:var(--ink)]">{label}</span>
      <button type="button" aria-label="Next" onClick={onNext} disabled={nextDisabled} className={btn}>›</button>
    </div>
  );
}

/** Download rows as a CSV file. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
