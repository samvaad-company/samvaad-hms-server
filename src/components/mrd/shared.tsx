"use client";

import type { ReactNode } from "react";
import { tw } from "@/lib/design-system";

export { btn, th, td, mono, Empty } from "@/components/bloodbank/shared";

/** The text label above a dialog field. */
export const fieldLabel = "text-[14px] font-medium text-[color:var(--ink)]";

/** Run a save and say whether it worked — the failure is already on the mutation's `error`. */
export async function attempt(p: Promise<unknown>): Promise<boolean> {
  try { await p; return true; } catch { return false; }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "30 Sep 2026" from an ISO date or timestamp; "-" when there isn't one. */
export function dmy(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "-";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "Fri, 18 Sept" — the day and month, as the coding queue shows when a chart arrived. */
export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const mon = d.getMonth() === 8 ? "Sept" : MONTHS[d.getMonth()];
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${mon}`;
}

/** "26 Oct, 11:25" in the viewer's timezone. */
export function stampShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const todayLocal = () => new Date().toLocaleDateString("en-CA");
export const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

const TONES: Record<string, string> = {
  green: "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  blue: "bg-[#e3efff] text-[#0a5fc4] border-[#b9d3ff]",
  amber: "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  red: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  grey: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
  plain: "bg-[color:var(--surface)] text-[color:var(--ink)] border-[color:var(--line)]",
};

/** Status word → colour, across every MRD screen. */
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  Available: "green", "Checked out": "blue", "In transit": "amber", Archived: "grey",
  Pending: "amber", Dispatched: "blue", Returned: "green", Cancelled: "grey", Urgent: "red", Routine: "plain",
  "In review": "blue", Deficient: "red", Coded: "amber", "Signed off": "green",
  Waiting: "amber", Signed: "green", Refused: "red", Expired: "grey", Open: "red", Resolved: "green",
  Due: "red", Extended: "blue", Active: "green",
  Dirty: "grey", Packed: "plain", "In cycle": "blue", Sterile: "green", Issued: "amber", "Expired sterility": "red", Requested: "grey", Running: "amber", Passed: "green", Failed: "red", Quarantined: "red",
  Approved: "green", Rejected: "red", Draft: "amber", Finalized: "green", "On Leave": "amber",
};

export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  const t = TONES[tone ?? ""] ?? TONES[STATUS_TONE[String(children)] ?? "grey"];
  return <span className={`inline-flex items-center rounded-full border px-[10px] py-[1px] text-[12px] leading-[18px] whitespace-nowrap ${t}`}>{children}</span>;
}

/** The soft green action button of the file-room screens (Return, Checkout, Retrieve…). */
export const softBtn = "inline-flex items-center justify-center gap-[6px] rounded-[8px] px-3 h-[30px] text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors bg-[color:var(--brand-soft)] text-[color:var(--brand)] hover:bg-[color:var(--subtle-2)] disabled:opacity-50 disabled:cursor-not-allowed";
export const outlineBtn = "inline-flex items-center justify-center gap-[6px] rounded-[8px] px-3 h-[30px] text-[13px] whitespace-nowrap cursor-pointer transition-colors border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] disabled:opacity-50 disabled:cursor-not-allowed";
export const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-[8px] px-4 h-[36px] text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed";
export const cancelBtn = "h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer";

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{message}</p>;
}

/** Cancel + the dialog's main button, as the Modal footer. */
export function DialogButtons({ onCancel, onConfirm, label, busyLabel, loading, disabled, danger }: {
  onCancel: () => void; onConfirm: () => void; label: string; busyLabel?: string; loading?: boolean; disabled?: boolean; danger?: boolean;
}) {
  return (
    <>
      <button onClick={onCancel} className={cancelBtn}>Cancel</button>
      <button onClick={onConfirm} disabled={loading || disabled}
        className={`h-[36px] rounded-[8px] px-5 text-[13px] font-medium text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${danger ? "bg-[#c8001a] hover:bg-[#a30015]" : "bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]"}`}>
        {loading ? busyLabel ?? "Saving…" : label}
      </button>
    </>
  );
}

/** One MRD page: a card with the module's icon and title, an optional right-hand slot, then the tab strip. */
export function MrdShell<T extends string>({ icon, title, note, tabs, tab, onTab, right, children }: {
  icon: ReactNode; title: string; note?: string; tabs?: readonly { id: T; label: string }[]; tab?: T; onTab?: (t: T) => void; right?: ReactNode; children: ReactNode;
}) {
  return (
    <div className={`${tw.gutterX} mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 flex-wrap border-b border-[color:var(--line)] px-5 py-3">
          <span className="text-[color:var(--ink-soft)]">{icon}</span>
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">{title}</h1>
          {note && <span className="text-[13px] text-[color:var(--ink-soft)]">{note}</span>}
          {right && <div className="ml-auto">{right}</div>}
        </div>
        {tabs && tab && onTab && (
          <div className="px-5 pt-4">
            <div role="tablist" aria-label={title} className="inline-flex p-[3px] rounded-[10px] bg-[color:var(--subtle)]">
              {tabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
                  className={`h-[30px] px-3 rounded-[8px] text-[14px] cursor-pointer transition-colors ${tab === t.id ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** A dashboard tile: a small label over a big number. */
export function StatCard({ label, value, mono }: { label: string; value: number | string; mono?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
      <p className="text-[13px] text-[color:var(--ink-soft)]">{label}</p>
      <p className={`mt-1 text-[28px] font-bold leading-[34px] text-[color:var(--ink)] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export function StatGrid({ cols, children }: { cols: number; children: ReactNode }) {
  return <div className="grid gap-3 px-5 py-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div>;
}

/** A pill-shaped filter chip row (the coding queue's All / Pending / In review…). */
export function Chips<T extends string>({ items, value, onChange }: { items: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)} aria-pressed={value === c.id}
          className={`h-[26px] rounded-full border px-3 text-[12px] cursor-pointer transition-colors ${value === c.id ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
