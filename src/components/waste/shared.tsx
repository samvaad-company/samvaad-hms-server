"use client";

import type { ReactNode } from "react";
import type { WasteCategoryKey } from "@/types/api";

export const CATEGORY_TONE: Record<WasteCategoryKey, string> = {
  white: "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)]",
  red: "border-[#f3b4b4] bg-[#ffe9e9] text-[#a3001a]",
  yellow: "border-[#f1da8a] bg-[#fff8d6] text-[#7a5a00]",
  blue: "border-[#b9c6f3] bg-[#e8eeff] text-[#2c43a8]",
};
export const CATEGORY_BAR: Record<WasteCategoryKey, string> = { white: "#9a9aa3", red: "#d9364a", yellow: "#e3b300", blue: "#3f63d6" };
export const CATEGORIES: { key: WasteCategoryKey; label: string }[] = [
  { key: "white", label: "White (sharps)" }, { key: "red", label: "Red (contaminated recyclable)" }, { key: "yellow", label: "Yellow (anatomical / soiled)" }, { key: "blue", label: "Blue (glass / metallic)" },
];

export const CategoryChip = ({ category, label }: { category: WasteCategoryKey; label: string }) => (
  <span className={`inline-block rounded-full border px-[10px] py-[1px] text-[12px] ${CATEGORY_TONE[category]}`}>{label}</span>
);

export const ghostBtn = "inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] font-medium hover:bg-[color:var(--subtle)] disabled:cursor-not-allowed disabled:opacity-50";
export const primaryBtn = "inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-3 py-[7px] text-[13px] font-medium text-white disabled:opacity-50";
export const kg = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const Stat = ({ label, value, sub, bad }: { label: string; value: ReactNode; sub?: string; bad?: boolean }) => (
  <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
    <p className="text-[13px] text-[color:var(--ink-soft)]">{label}</p>
    <p className={`mt-1 font-mono text-[24px] font-bold leading-8 ${bad ? "text-[#d10024]" : ""}`}>{value}</p>
    {sub && <p className="text-[12px] text-[color:var(--ink-soft)]">{sub}</p>}
  </div>
);
export const Err = ({ message }: { message?: string }) => (message ? <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{message}</p> : null);
