"use client";

import type { ReactNode } from "react";
import { SEROLOGY_TESTS, type BloodUnitDTO, type SerologyDTO } from "@/types/api";
import type { BloodGroup } from "@/types";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "26 Sept, 23:43" — day, month and 24-hour time, in the viewer's timezone. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const todayLocal = () => new Date().toLocaleDateString("en-CA");

export const DISCARD_REASONS = [
  "Expired",
  "Reactive serology",
  "Haemolysed / lipaemic",
  "Clotted",
  "Bag leak or damage",
  "Cold chain break",
  "Other",
] as const;

export const REACTION_KINDS = [
  "Febrile non-haemolytic",
  "Allergic / urticarial",
  "Acute haemolytic",
  "Delayed haemolytic",
  "TRALI",
  "TACO (circulatory overload)",
  "Bacterial contamination",
  "Anaphylaxis",
  "Other",
] as const;

export const ID_PROOF_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  voter_id: "Voter ID",
  driving_licence: "Driving licence",
  passport: "Passport",
};

/** A unit's group split into the ABO letter(s) and Rh sign, as the Collect / Register forms ask for them. */
export const splitGroup = (g: string): { abo: string; rh: "+ve" | "-ve" } => ({ abo: g.replace(/[+-]$/, ""), rh: g.endsWith("+") ? "+ve" : "-ve" });
export const joinGroup = (abo: string, rh: string): BloodGroup => `${abo}${rh.startsWith("+") ? "+" : "-"}` as BloodGroup;

/** Mirror of the server's ABO / Rh rule, only to hide units that could never be issued to the chosen patient. */
export function compatible(patientGroup: string | null | undefined, unit: Pick<BloodUnitDTO, "bloodGroup" | "component">): boolean {
  if (!patientGroup || !/^(A|B|AB|O)[+-]$/.test(patientGroup)) return true;
  const p = splitGroup(patientGroup);
  const u = splitGroup(unit.bloodGroup);
  if (unit.component === "Whole blood" || unit.component === "PRBC") {
    return (u.abo === "O" || u.abo === p.abo || p.abo === "AB") && !(u.rh === "+ve" && p.rh === "-ve");
  }
  if (unit.component === "Plasma") return u.abo === "AB" || u.abo === p.abo || p.abo === "O";
  return true;
}

const PILL: Record<string, string> = {
  Discarded: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  Available: "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  "Cross-matched": "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  Quarantined: "bg-[color:var(--subtle)] text-[color:var(--ink)] border-[color:var(--line)]",
  Issued: "bg-[#e8f1ff] text-[#0a5fc4] border-[#b9d3ff]",
  Processed: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
  Eligible: "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  Deferred: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  requested: "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  resulted: "bg-[color:var(--subtle)] text-[color:var(--ink)] border-[color:var(--line)]",
  issued: "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  cancelled: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
};

export function Pill({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-[10px] py-[1px] text-[12px] leading-[18px] whitespace-nowrap ${PILL[tone] ?? PILL.Quarantined}`}>
      {children}
    </span>
  );
}

/** The five mandatory tests as one line of words: green = negative, red = reactive, grey = not yet tested. */
export function SerologyFlags({ s }: { s: SerologyDTO }) {
  return (
    <span className="font-mono text-[12px] whitespace-nowrap">
      {SEROLOGY_TESTS.map((t, i) => {
        const v = s[t.key];
        const cls = v === "Reactive" ? "text-[#c8001a] font-bold" : v === "Negative" ? "text-[#0b7a47]" : "text-[color:var(--ink-soft)]";
        return <span key={t.key} className={cls} title={`${t.label}: ${v || "not tested"}`}>{t.label}{i < SEROLOGY_TESTS.length - 1 ? " " : ""}</span>;
      })}
    </span>
  );
}

export const btn = {
  base: "inline-flex items-center justify-center gap-[6px] rounded-[8px] px-3 text-[12px] whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[30px]",
  ghost: "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]",
  danger: "border border-[color:var(--line)] bg-[color:var(--surface)] text-[#c8001a] hover:bg-[#ffe9e9]",
  solid: "bg-[color:var(--brand)] font-medium text-white hover:bg-[color:var(--brand-hover)]",
  primary: "inline-flex items-center justify-center gap-2 rounded-[8px] px-4 h-[36px] text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed",
} as const;

/** The title row of a tab: what it is, a line of context, and the tab's main action on the right. */
export function SectionHead({ title, note, count, action }: { title: string; note?: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-5 py-4">
      <h2 className="text-[15px] font-semibold text-[color:var(--ink)]">{title}</h2>
      {count != null && <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{count}</span>}
      {note && <span className="text-[12px] text-[color:var(--ink-soft)]">{note}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export const th = "px-4 py-[10px] text-left text-[13px] font-medium text-[color:var(--ink)] whitespace-nowrap";
export const td = "px-4 py-[10px] text-[13px] text-[color:var(--ink)]";
export const mono = "font-mono text-[13px]";

export const Empty = ({ children }: { children: ReactNode }) => <div className="py-14 text-center text-[14px] text-[color:var(--ink-soft)]">{children}</div>;
