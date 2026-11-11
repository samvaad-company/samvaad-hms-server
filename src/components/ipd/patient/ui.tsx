"use client";

/** Small pieces shared by the tabs of the inpatient chart. */
import type { ReactNode } from "react";
import type { IpdOverviewDTO, IpdRecordDTO } from "@/types/api";

export { btn, clock, done, inputCls, useAutoRefresh, when } from "@/components/ipd/nurse/shared";

/** What every tab is given about the patient it is showing. */
export interface ChartCtx {
  id: number;
  record: IpdRecordDTO;
  overview: IpdOverviewDTO | null;
  /** Re-read the patient and the overview after something changed. */
  refresh: () => void;
  /** Open another tab of the chart. */
  go: (tab: string) => void;
  canWrite: boolean;
  canNurse: boolean;
  isDoctor: boolean;
  discharged: boolean;
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const dayShort = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
export const dateTime = (iso: string) => `${dayShort(iso)}, ${timeOf(iso)}`;

/** "38h 42m" for a number of minutes. */
export const spanLabel = (min: number) => (min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`);

export function Card({ title, hint, action, children, className = "" }: { title?: ReactNode; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold text-[color:var(--ink)]">{title}</h3>}
            {hint && <p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-[color:var(--subtle)] text-[color:var(--ink)] border-[color:var(--line)]",
  ok: "bg-[#e6f7ee] text-[#0b7a47] border-[#b9e5cd]",
  warn: "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  bad: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  info: "bg-[#e3f0ff] text-[#0b4fa3] border-[#b5d4f7]",
} as const;

export function Pill({ tone = "neutral", children, className = "" }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-[8px] py-[1px] text-[11px] font-medium whitespace-nowrap ${TONES[tone]} ${className}`}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "bad" | "warn" | "ok" }) {
  const color = tone === "bad" ? "text-[#b3001b]" : tone === "warn" ? "text-[#a35a00]" : tone === "ok" ? "text-[#0b7a47]" : "text-[color:var(--ink)]";
  return (
    <div className="min-w-0 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
      <p className="text-[11px] text-[color:var(--ink-soft)]">{label}</p>
      <p className={`text-[22px] font-semibold leading-[28px] ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-[color:var(--ink-soft)]">{sub}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "ok"; children: ReactNode }) {
  return <p className={`rounded-[8px] border px-3 py-2 text-[12px] ${TONES[tone]}`}>{children}</p>;
}

export function ErrorLine({ error }: { error: { message: string } | null }) {
  return error ? <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[12px] text-[#c8001a]">{error.message}</p> : null;
}

/** An underlined text button used for the small actions inside cards ("Edit", "Add", "Change"). */
export function LinkButton({ children, onClick, disabled, danger }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`cursor-pointer text-[12px] hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "text-[#c8001a]" : "text-[color:var(--brand)]"}`}>
      {children}
    </button>
  );
}
