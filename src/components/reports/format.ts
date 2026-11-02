import type { ReportColumnDTO } from "@/types/api";
import { dmy } from "@/components/mrd/shared";

/** ₹1,23,456 — whole rupees, Indian digit grouping. */
export const inr = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** ₹1,234.50 — exact, for ledgers and totals. */
export const inrExact = (n: number): string => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** ₹3.6L / ₹90k — short axis labels. */
export function inrShort(n: number): string {
  if (n >= 10_000_000) return `₹${+(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${+(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${+(n / 1_000).toFixed(1)}k`.replace(".0k", "k");
  return `₹${Math.round(n)}`;
}

/** A cell of a report table as text, by the column's format. */
export function cellText(value: string | number | null | undefined, fmt: ReportColumnDTO["fmt"] = "text"): string {
  if (value === null || value === undefined || value === "") return "—";
  if (fmt === "money") return inrExact(Number(value));
  if (fmt === "int") return Number(value).toLocaleString("en-IN");
  if (fmt === "pct") return `${value}%`;
  if (fmt === "date") return dmy(String(value));
  return String(value);
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Save text as a file through the browser. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
