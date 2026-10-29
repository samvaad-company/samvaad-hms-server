"use client";

/** Leave tabs: requests (approve, reject, cancel), yearly balances, the month calendar and the leave types. */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import type { HrLeaveCalendarDTO, HrLeaveRequestDTO, HrLeaveTypeDTO, HrStaffBalanceDTO } from "@/types/api";
import { Chips, dmy, Empty, ErrorNote, outlineBtn, Pill, primaryBtn, softBtn, td, th, todayLocal } from "@/components/mrd/shared";
import { attempt, monthLabel, shiftMonth, Stepper } from "@/components/hr/shared";
import { DecideLeaveDialog, LeaveTypeDialog } from "@/components/hr/HrDialogs";

const STATUS_CHIPS = [
  { id: "Pending", label: "Waiting" }, { id: "Approved", label: "Approved" }, { id: "Rejected", label: "Rejected" }, { id: "Cancelled", label: "Cancelled" }, { id: "All", label: "All" },
] as const;
type StatusChip = (typeof STATUS_CHIPS)[number]["id"];

export function RequestsView({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<StatusChip>("Pending");
  const { items, loading, reload } = useList<HrLeaveRequestDTO>("/hr/leave", status === "All" ? undefined : { status });
  const { run, error, reset } = useMutation();
  const [deciding, setDeciding] = useState<{ request: HrLeaveRequestDTO; decision: "Approved" | "Rejected" } | null>(null);
  const today = todayLocal();
  const cancel = async (r: HrLeaveRequestDTO) => { reset(); await attempt(run(() => api.post(`/hr/leave/${r.id}/cancel`))); reload(); };

  return (
    <div className="px-5 pb-5 pt-4">
      <Chips items={STATUS_CHIPS} value={status} onChange={setStatus} />
      <div className="mt-3"><ErrorNote message={error?.message} /></div>
      {items.length === 0 ? (
        <Empty>{loading ? "Loading…" : status === "Pending" ? "No leave is waiting for a decision." : "No leave requests here."}</Empty>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full min-w-[860px] text-left">
            <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Staff", "Type", "Dates", "Days", "Reason", "Status", "Action"].map((h, i) => <th key={h} className={`${th} ${i === 6 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map((r) => {
                const cancellable = r.status === "Pending" || (r.status === "Approved" && r.fromDate > today);
                return (
                  <tr key={r.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)] align-top">
                    <td className={td}><p className="font-medium">{r.staffName}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{r.department}</p></td>
                    <td className={`${td} whitespace-nowrap`}>{r.typeName}{!r.paid && <span className="ml-1 text-[12px] text-[color:var(--ink-soft)]">(unpaid)</span>}</td>
                    <td className={`${td} whitespace-nowrap`}>{r.fromDate === r.toDate ? dmy(r.fromDate) : `${dmy(r.fromDate)} – ${dmy(r.toDate)}`}</td>
                    <td className={td}>{r.days}</td>
                    <td className={`${td} max-w-[240px]`}>
                      <p className="truncate" title={r.reason}>{r.reason || "—"}</p>
                      {r.decisionNote && <p className="truncate text-[12px] text-[color:var(--ink-soft)]" title={r.decisionNote}>{r.decidedBy}: {r.decisionNote}</p>}
                    </td>
                    <td className={td}><Pill>{r.status}</Pill></td>
                    <td className={`${td} text-right`}>
                      {canWrite && (
                        <div className="flex justify-end gap-2">
                          {r.status === "Pending" && <button onClick={() => setDeciding({ request: r, decision: "Approved" })} className={softBtn}>Approve</button>}
                          {r.status === "Pending" && <button onClick={() => setDeciding({ request: r, decision: "Rejected" })} className={outlineBtn}>Reject</button>}
                          {cancellable && <button onClick={() => cancel(r)} className={outlineBtn}>Cancel</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {deciding && <DecideLeaveDialog request={deciding.request} decision={deciding.decision} onClose={() => { setDeciding(null); reload(); }} />}
    </div>
  );
}

export function BalancesView() {
  const thisYear = Number(todayLocal().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { items, loading } = useList<HrStaffBalanceDTO>("/hr/leave/balances", { year });
  const codes = items[0]?.balances ?? [];
  return (
    <div className="px-5 pb-5 pt-4">
      <Stepper label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} nextDisabled={year >= thisYear + 1} />
      {items.length === 0 ? <Empty>{loading ? "Loading…" : "No staff yet."}</Empty> : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full text-left" style={{ minWidth: 240 + codes.length * 150 }}>
            <thead>
              <tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">
                <th className={th}>Staff</th>
                {codes.map((b) => <th key={b.typeId} className={th}>{b.name} <span className="font-normal text-[color:var(--ink-soft)]">{b.allocated > 0 ? `(${b.allocated})` : "(no limit)"}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.staffId} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                  <td className={td}><p className="font-medium">{s.name}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{s.role}</p></td>
                  {s.balances.map((b) => (
                    <td key={b.typeId} className={td}>
                      {b.allocated > 0 ? (
                        <>
                          <span className={`font-mono ${b.remaining === 0 ? "text-[#c8001a]" : ""}`}>{b.remaining} left</span>
                          <span className="ml-2 text-[12px] text-[color:var(--ink-soft)]">{b.used} taken{b.pending > 0 ? `, ${b.pending} waiting` : ""}</span>
                        </>
                      ) : (
                        <span className="text-[12px] text-[color:var(--ink-soft)]">{b.used} taken{b.pending > 0 ? `, ${b.pending} waiting` : ""}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CalendarView() {
  const thisMonth = todayLocal().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { item: cal, loading } = useItem<HrLeaveCalendarDTO>(`/hr/leave/calendar?month=${month}`);
  const today = todayLocal();
  const days = cal ? Array.from({ length: cal.daysInMonth }, (_, i) => i + 1) : [];
  const away = cal?.staff.filter((s) => Object.keys(s.days).length > 0) ?? [];
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-4">
        <Stepper label={monthLabel(month)} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />
        <span className="flex items-center gap-3 text-[12px] text-[color:var(--ink-soft)]"><i className="inline-block h-3 w-3 rounded-[3px] bg-[#9fe3c6]" /> Approved <i className="inline-block h-3 w-3 rounded-[3px] bg-[#f3cf7d]" /> Waiting</span>
      </div>
      {!cal || away.length === 0 ? <Empty>{loading ? "Loading…" : `No one is on leave in ${monthLabel(month)}.`}</Empty> : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="border-collapse text-left" style={{ minWidth: 200 + days.length * 30 }}>
            <thead>
              <tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">
                <th className={`${th} sticky left-0 z-10 min-w-[190px] bg-[color:var(--faint)]`}>Staff</th>
                {days.map((d) => {
                  const iso = `${month}-${String(d).padStart(2, "0")}`;
                  return <th key={d} className={`w-[30px] min-w-[30px] px-0 py-[10px] text-center text-[12px] font-medium ${iso === today ? "text-[color:var(--brand)]" : "text-[color:var(--ink-soft)]"}`}>{d}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {away.map((s) => (
                <tr key={s.staffId} className="border-b border-[color:var(--line)] last:border-b-0">
                  <td className={`${td} sticky left-0 bg-[color:var(--surface)]`}><p className="font-medium">{s.name}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{s.role}</p></td>
                  {days.map((d) => {
                    const c = s.days[String(d)];
                    return (
                      <td key={d} className="h-[44px] w-[30px] p-[2px]">
                        {c && <div title={`${c.code} · ${c.status}`} className={`flex h-full items-center justify-center rounded-[4px] text-[10px] font-medium ${c.status === "Approved" ? "bg-[#9fe3c6] text-[#0b5a36]" : "bg-[#f3cf7d] text-[#6b4300]"}`}>{c.code}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LeaveTypesView({ canWrite }: { canWrite: boolean }) {
  const { items, reload } = useList<HrLeaveTypeDTO>("/hr/leave-types");
  const [editing, setEditing] = useState<HrLeaveTypeDTO | "new" | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      {canWrite && <div className="mb-3 flex justify-end"><button onClick={() => setEditing("new")} className={primaryBtn}>+ New leave type</button></div>}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[560px] text-left">
          <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Name", "Code", "Days a year", "Pay", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} font-medium`}>{t.name}</td>
                <td className={`${td} font-mono`}>{t.code}</td>
                <td className={td}>{t.daysPerYear > 0 ? t.daysPerYear : "No limit"}</td>
                <td className={td}>{t.paid ? "Paid" : "Unpaid"}</td>
                <td className={td}><Pill tone={t.active ? "green" : "grey"}>{t.active ? "In use" : "Switched off"}</Pill></td>
                <td className={`${td} text-right`}>{canWrite && <button onClick={() => setEditing(t)} className={outlineBtn}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-[color:var(--ink-soft)]">Unpaid leave is what payroll deducts. Paid leave comes out of the yearly allowance but not out of pay.</p>
      {editing && <LeaveTypeDialog type={editing === "new" ? undefined : editing} onClose={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
