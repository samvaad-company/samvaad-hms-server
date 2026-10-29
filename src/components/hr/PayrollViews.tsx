"use client";

/** Payroll tabs: monthly runs with their payslips (adjust, finalize, print, CSV) and each person's salary structure. */
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Download, Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { printElement } from "@/lib/print";
import type { HrPayrollRunDTO, HrPayrollRunDetailDTO, HrPayslipDTO, HrSalaryDTO } from "@/types/api";
import { Empty, ErrorNote, outlineBtn, Pill, primaryBtn, softBtn, StatCard, StatGrid, stampShort, td, th } from "@/components/mrd/shared";
import { attempt, downloadCsv, monthLabel, rupees } from "@/components/hr/shared";
import { AdjustPayslipDialog, RunPayrollDialog, SalaryDialog } from "@/components/hr/HrDialogs";
import { PayslipDocument } from "@/components/hr/Payslip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ── Runs ─────────────────────────────────────────────────────────────────────

export function RunsView({ canWrite, running, onRunClosed }: { canWrite: boolean; running: boolean; onRunClosed: () => void }) {
  const { items: runs, loading, reload } = useList<HrPayrollRunDTO>("/hr/payroll");
  const [openId, setOpenId] = useState<number | null>(null);
  const [fresh, setFresh] = useState<HrPayrollRunDetailDTO | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      {openId != null ? (
        <RunDetail id={openId} initial={fresh} canWrite={canWrite} onBack={() => { setOpenId(null); setFresh(null); reload(); }} />
      ) : runs.length === 0 ? (
        <Empty>{loading ? "Loading…" : "No payroll has been run yet. Set salaries, then run payroll for a month."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full min-w-[700px] text-left">
            <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Month", "Status", "Staff", "Gross", "Net pay", "Prepared by", ""].map((h, i) => <th key={h} className={`${th} ${i === 3 || i === 4 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                  <td className={`${td} font-medium`}>{monthLabel(r.month)}</td>
                  <td className={td}><Pill>{r.status}</Pill></td>
                  <td className={td}>{r.staffCount}</td>
                  <td className={`${td} text-right font-mono`}>{rupees(r.totalGross)}</td>
                  <td className={`${td} text-right font-mono`}>{rupees(r.totalNet)}</td>
                  <td className={td}>{r.createdBy}{r.finalizedAt && <span className="block text-[12px] text-[color:var(--ink-soft)]">Finalized {stampShort(r.finalizedAt)}</span>}</td>
                  <td className={`${td} text-right`}><button onClick={() => setOpenId(r.id)} className={softBtn}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {running && (
        <RunPayrollDialog onClose={onRunClosed} onDone={(run) => { setFresh(run); setOpenId(run.id); }} />
      )}
    </div>
  );
}

function RunDetail({ id, initial, canWrite, onBack }: { id: number; initial: HrPayrollRunDetailDTO | null; canWrite: boolean; onBack: () => void }) {
  const { item, reload } = useItem<HrPayrollRunDetailDTO>(`/hr/payroll/${id}`);
  const run = item ?? initial;
  const { run: act, error, reset, loading } = useMutation();
  const [adjusting, setAdjusting] = useState<HrPayslipDTO | null>(null);
  const [confirm, setConfirm] = useState<"finalize" | "delete" | null>(null);
  const [printing, setPrinting] = useState<HrPayslipDTO | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  if (!run) return <Empty>Loading…</Empty>;
  const draft = run.status === "Draft";

  async function finalize() { reset(); if (await attempt(act(() => api.post(`/hr/payroll/${id}/finalize`)))) reload(); setConfirm(null); }
  async function remove() { reset(); if (await attempt(act(() => api.del(`/hr/payroll/${id}`)))) onBack(); setConfirm(null); }
  async function regenerate() { reset(); if (await attempt(act(() => api.post("/hr/payroll", { month: run!.month })))) reload(); }
  function print(slip: HrPayslipDTO) {
    flushSync(() => setPrinting(slip));
    printElement(docRef.current?.firstElementChild as HTMLElement | null, `Payslip - ${slip.staffName} - ${slip.month}`);
  }
  function exportCsv() {
    downloadCsv(`payroll-${run!.month}.csv`, [
      ["Employee ID", "Name", "Role", "Department", "Days in month", "Days paid", "Unpaid leave days", "Extra LOP days", "Basic", "HRA", "Allowances", "Gross", "PF", "Professional tax", "Other deductions", "Net pay"],
      ...run!.payslips.map((p) => [p.employeeNo, p.staffName, p.role, p.department, p.monthDays, p.paidDays, p.unpaidLeaveDays, p.lopAdjust, p.basic, p.hra, p.allowances, p.gross, p.pf, p.profTax, p.otherDeduction, p.netPay]),
    ]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className={outlineBtn + " !h-[32px]"}>‹ All months</button>
        <h2 className="text-[16px] font-semibold text-[color:var(--ink)]">{monthLabel(run.month)}</h2>
        <Pill>{run.status}</Pill>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={exportCsv} className={outlineBtn + " !h-[36px]"}><Download size={14} /> CSV</button>
          {canWrite && draft && <button onClick={regenerate} disabled={loading} className={outlineBtn + " !h-[36px]"}>Recalculate</button>}
          {canWrite && draft && <button onClick={() => setConfirm("delete")} className={outlineBtn + " !h-[36px]"}>Delete draft</button>}
          {canWrite && draft && <button onClick={() => setConfirm("finalize")} disabled={run.payslips.length === 0} className={primaryBtn}>Finalize</button>}
        </div>
      </div>
      <div className="mt-3"><ErrorNote message={error?.message} /></div>
      <StatGrid cols={3}>
        <StatCard label="Payslips" value={run.staffCount} />
        <StatCard label="Gross pay" value={rupees(run.totalGross)} mono />
        <StatCard label="Net pay" value={rupees(run.totalNet)} mono />
      </StatGrid>
      {draft && <p className="mb-3 text-[13px] text-[color:var(--ink-soft)]">This is a draft: adjust payslips or recalculate after changing salaries or leave. Finalizing locks every figure.</p>}
      {run.skipped.length > 0 && (
        <div role="status" className="mb-3 rounded-[8px] border border-[#f3e29a] bg-[#fffbe0] px-4 py-3 text-[13px] text-[#7a5a00]">
          Not in this run: {run.skipped.map((s, i) => <span key={s.staffId}>{s.name} ({s.reason.toLowerCase()}){i < run.skipped.length - 1 ? ", " : ""}</span>)}
        </div>
      )}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[980px] text-left">
          <thead>
            <tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">
              {["Employee", "Days paid", "Unpaid leave", "No punch*", "Gross", "PF", "Tax", "Other", "Net pay", ""].map((h, i) => <th key={h + i} className={`${th} ${i >= 4 && i <= 8 ? "text-right" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {run.payslips.length === 0 && <tr><td colSpan={10}><Empty>No payslips — set salaries first, then recalculate.</Empty></td></tr>}
            {run.payslips.map((p) => (
              <tr key={p.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={td}><p className="font-medium">{p.staffName}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{p.employeeNo} · {p.role}</p></td>
                <td className={td}>{p.paidDays}<span className="text-[color:var(--ink-soft)]"> / {p.monthDays}</span>{p.lopAdjust > 0 && <span className="ml-1 text-[12px] text-[#8a5300]">(−{p.lopAdjust} LOP)</span>}</td>
                <td className={td}>{p.unpaidLeaveDays || "—"}</td>
                <td className={`${td} ${p.absentDays > 0 ? "text-[#8a5300]" : "text-[color:var(--ink-soft)]"}`}>{p.absentDays || "—"}</td>
                <td className={`${td} text-right font-mono`}>{rupees(p.gross)}</td>
                <td className={`${td} text-right font-mono`}>{rupees(p.pf)}</td>
                <td className={`${td} text-right font-mono`}>{rupees(p.profTax)}</td>
                <td className={`${td} text-right font-mono`}>{rupees(p.otherDeduction)}</td>
                <td className={`${td} text-right font-mono font-semibold`}>{rupees(p.netPay)}</td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-2">
                    {canWrite && draft && <button onClick={() => setAdjusting(p)} className={outlineBtn}>Adjust</button>}
                    <button onClick={() => print(p)} aria-label={`Print payslip for ${p.staffName}`} className={outlineBtn}><Printer size={13} /> Payslip</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">* Days with no attendance punch and no leave. These include weekly offs, so they are not deducted unless you add loss-of-pay days under Adjust.</p>
      {adjusting && <AdjustPayslipDialog slip={adjusting} onClose={() => { setAdjusting(null); reload(); }} />}
      <ConfirmDialog open={confirm === "finalize"} title={`Finalize ${monthLabel(run.month)}?`} message="Every payslip becomes final and the month can't be run again."
        confirmLabel="Finalize" danger={false} onConfirm={finalize} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "delete"} title="Delete this draft?" message={`The draft payroll for ${monthLabel(run.month)} is removed. You can run it again.`}
        confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setConfirm(null)} />
      <div ref={docRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0 }}>{printing && <PayslipDocument slip={printing} finalized={!draft} />}</div>
    </div>
  );
}

// ── Salaries ─────────────────────────────────────────────────────────────────

export function SalariesView({ canWrite }: { canWrite: boolean }) {
  const { items, loading, reload } = useList<HrSalaryDTO>("/hr/salaries");
  const [editing, setEditing] = useState<HrSalaryDTO | null>(null);
  const missing = items.filter((s) => !s.set).length;
  return (
    <div className="px-5 pb-5 pt-4">
      {missing > 0 && <p role="status" className="mb-3 rounded-[8px] border border-[#f3e29a] bg-[#fffbe0] px-4 py-3 text-[13px] text-[#7a5a00]">{missing} {missing === 1 ? "person has" : "people have"} no salary set and won&apos;t be in payroll.</p>}
      {items.length === 0 ? <Empty>{loading ? "Loading…" : "No staff yet."}</Empty> : (
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full min-w-[820px] text-left">
            <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Employee", "Basic", "HRA", "Allowances", "Gross", "PF %", "Prof. tax", ""].map((h, i) => <th key={h + i} className={`${th} ${i >= 1 && i <= 6 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.staffId} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                  <td className={td}><p className="font-medium">{s.name}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{s.employeeNo} · {s.role}</p></td>
                  {s.set ? (
                    <>
                      <td className={`${td} text-right font-mono`}>{rupees(s.basic)}</td>
                      <td className={`${td} text-right font-mono`}>{rupees(s.hra)}</td>
                      <td className={`${td} text-right font-mono`}>{rupees(s.allowances)}</td>
                      <td className={`${td} text-right font-mono font-semibold`}>{rupees(s.gross)}</td>
                      <td className={`${td} text-right font-mono`}>{s.pfPercent}</td>
                      <td className={`${td} text-right font-mono`}>{rupees(s.profTax)}</td>
                    </>
                  ) : <td colSpan={6} className={`${td} text-[color:var(--ink-soft)]`}>Not set</td>}
                  <td className={`${td} text-right`}>{canWrite && <button onClick={() => setEditing(s)} className={s.set ? outlineBtn : softBtn}>{s.set ? "Edit" : "Set salary"}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <SalaryDialog salary={editing} onClose={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
