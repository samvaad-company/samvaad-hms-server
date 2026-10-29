"use client";

/** A printable payslip. Rendered off-screen and handed to printElement, so it uses plain, print-safe styling. */
import type { HrPayslipDTO } from "@/types/api";
import { monthLabel, rupees } from "@/components/hr/shared";

export function PayslipDocument({ slip, finalized }: { slip: HrPayslipDTO; finalized: boolean }) {
  const earnings: [string, number][] = [["Basic", slip.basic], ["House rent allowance", slip.hra], ["Other allowances", slip.allowances]];
  const deductions: [string, number][] = [["Provident fund", slip.pf], ["Professional tax", slip.profTax], ["Other deductions", slip.otherDeduction]];
  const cell = "border: 1px solid #d0d5dd; padding: 6px 10px; font-size: 13px;";
  const row = (label: string, amount: number, bold = false) => (
    <tr key={label}><td style={{ ...style(cell), fontWeight: bold ? 600 : 400 }}>{label}</td><td style={{ ...style(cell), textAlign: "right", fontWeight: bold ? 600 : 400 }}>{rupees(amount)}</td></tr>
  );
  return (
    <div style={{ width: 720, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <div style={{ borderBottom: "2px solid #111827", paddingBottom: 8, marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Payslip — {monthLabel(slip.month)}</h1>
        {!finalized && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309" }}>DRAFT — not final until payroll for the month is finalized</p>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 13 }}>
        <tbody>
          <tr><td style={{ padding: "3px 0", width: "50%" }}><b>Employee:</b> {slip.staffName}</td><td><b>Employee ID:</b> {slip.employeeNo}</td></tr>
          <tr><td style={{ padding: "3px 0" }}><b>Role:</b> {slip.role}</td><td><b>Department:</b> {slip.department || "—"}</td></tr>
          <tr><td style={{ padding: "3px 0" }}><b>Days in month:</b> {slip.monthDays}</td><td><b>Days paid:</b> {slip.paidDays}{slip.paidDays < slip.monthDays ? ` (${slip.monthDays - slip.paidDays} unpaid)` : ""}</td></tr>
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 14 }}>
        <table style={{ flex: 1, borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...style(cell), textAlign: "left", background: "#f3f4f6" }}>Earnings</th><th style={{ ...style(cell), textAlign: "right", background: "#f3f4f6" }}>Amount</th></tr></thead>
          <tbody>{earnings.map(([l, a]) => row(l, a))}{row("Gross pay", slip.gross, true)}</tbody>
        </table>
        <table style={{ flex: 1, borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...style(cell), textAlign: "left", background: "#f3f4f6" }}>Deductions</th><th style={{ ...style(cell), textAlign: "right", background: "#f3f4f6" }}>Amount</th></tr></thead>
          <tbody>{deductions.map(([l, a]) => row(l, a))}{row("Total deductions", slip.pf + slip.profTax + slip.otherDeduction, true)}</tbody>
        </table>
      </div>
      <div style={{ marginTop: 14, border: "2px solid #111827", padding: "10px 14px", display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
        <span>Net pay</span><span>{rupees(slip.netPay)}</span>
      </div>
      <p style={{ marginTop: 28, fontSize: 11, color: "#6b7280" }}>This is a computer-generated payslip.</p>
    </div>
  );
}

/** Turns a "border: 1px solid …; padding: …" string into a React style object. */
function style(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of css.split(";")) {
    const [k, v] = part.split(":");
    if (k && v) out[k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v.trim();
  }
  return out as React.CSSProperties;
}
