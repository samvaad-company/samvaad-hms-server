"use client";

/** HR dialogs: apply for / decide leave, leave types, shifts, copy a week, salary structure, run payroll, adjust a payslip. */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/shared/Modal";
import { FormInput } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { HrLeaveRequestDTO, HrLeaveTypeDTO, HrPayrollRunDetailDTO, HrPayslipDTO, HrSalaryDTO, HrShiftDTO } from "@/types/api";
import { dmy, DialogButtons, ErrorNote, fieldLabel, plusDays, todayLocal } from "@/components/mrd/shared";
import { addDaysIso, monthLabel, rupees, useActiveStaff, useAction, weekStart } from "@/components/hr/shared";
import { DEFAULT_PF_PERCENT, DEFAULT_PROF_TAX } from "@/types/hr";

const field = (label: string, node: React.ReactNode, hint?: string) => (
  <div className="flex flex-col gap-2"><span className={fieldLabel}>{label}</span>{node}{hint && <p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p>}</div>
);
const area = "w-full resize-y rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-[14px] py-[10px] text-[14px] leading-[22px] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none";
const checkRow = "flex items-center gap-2 text-[14px] text-[color:var(--ink)] cursor-pointer";

const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;

// ── Leave ────────────────────────────────────────────────────────────────────

export function ApplyLeaveDialog({ types, presetStaffId, onClose }: { types: HrLeaveTypeDTO[]; presetStaffId?: number; onClose: () => void }) {
  const staff = useActiveStaff();
  const { loading, error, close, submit } = useAction(onClose);
  const active = types.filter((t) => t.active);
  const [staffId, setStaffId] = useState(presetStaffId ? String(presetStaffId) : "");
  const [typeId, setTypeId] = useState("");
  const [from, setFrom] = useState(todayLocal());
  const [to, setTo] = useState(todayLocal());
  const [reason, setReason] = useState("");
  const type = active.find((t) => String(t.id) === typeId);
  const days = from && to && to >= from ? daysBetween(from, to) : 0;
  return (
    <Modal open onClose={close} width={480} title="Apply for leave" subtitle="Counts every calendar day from the first to the last. It waits for approval before it affects attendance or the roster."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post("/hr/leave", { staffId: Number(staffId), leaveTypeId: Number(typeId), fromDate: from, toDate: to, reason: reason.trim() }))} label="Apply" loading={loading} disabled={!staffId || !typeId || days < 1} />}>
      <div className="flex flex-col gap-4">
        {field("Staff member", <SearchSelect placeholder="Pick a person…" value={staffId} onChange={setStaffId} options={staff.map((s) => ({ value: String(s.id), label: s.name, hint: `${s.role} · ${s.department}` }))} />)}
        {field("Leave type", (
          <div className="flex flex-wrap gap-2">
            {active.map((t) => (
              <button key={t.id} type="button" aria-pressed={typeId === String(t.id)} onClick={() => setTypeId(String(t.id))}
                className={`h-[32px] rounded-full border px-3 text-[13px] cursor-pointer transition-colors ${typeId === String(t.id) ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
                {t.name}{t.daysPerYear > 0 ? ` · ${t.daysPerYear}/yr` : ""}{!t.paid ? " · unpaid" : ""}
              </button>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          {field("From", <FormInput type="date" value={from} onChange={(v) => { setFrom(v); if (to < v) setTo(v); }} />)}
          {field("To", <FormInput type="date" value={to} min={from} onChange={setTo} />)}
        </div>
        {days > 0 && <p className="text-[13px] text-[color:var(--ink-soft)]">{days} {days === 1 ? "day" : "days"}{type && !type.paid ? " — unpaid, so payroll will deduct it" : ""}</p>}
        {field("Reason (optional)", <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className={area} />)}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function DecideLeaveDialog({ request, decision, onClose }: { request: HrLeaveRequestDTO; decision: "Approved" | "Rejected"; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [note, setNote] = useState("");
  const reject = decision === "Rejected";
  return (
    <Modal open onClose={close} width={440} title={reject ? "Reject leave" : "Approve leave"}
      subtitle={`${request.staffName} · ${request.typeName} · ${request.days} ${request.days === 1 ? "day" : "days"} (${request.fromDate === request.toDate ? dmy(request.fromDate) : `${dmy(request.fromDate)} – ${dmy(request.toDate)}`})`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post(`/hr/leave/${request.id}/decision`, { decision, note: note.trim() }))} label={reject ? "Reject" : "Approve"} danger={reject} loading={loading} disabled={reject && note.trim().length < 3} />}>
      <div className="flex flex-col gap-4">
        {request.reason && <p className="rounded-[8px] bg-[color:var(--subtle)] px-3 py-2 text-[13px] text-[color:var(--ink)]">&ldquo;{request.reason}&rdquo;</p>}
        {field(reject ? "Reason for rejecting" : "Note (optional)", <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} className={area} />)}
        {!reject && <p className="text-[12px] text-[color:var(--ink-soft)]">Approving marks {request.staffName.split(" ")[0]} On Leave on those days and takes them off any shifts already rostered.</p>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function LeaveTypeDialog({ type, onClose }: { type?: HrLeaveTypeDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [name, setName] = useState(type?.name ?? "");
  const [code, setCode] = useState(type?.code ?? "");
  const [days, setDays] = useState(String(type?.daysPerYear ?? 0));
  const [paid, setPaid] = useState(type?.paid ?? true);
  const [active, setActive] = useState(type?.active ?? true);
  const body = { name: name.trim(), code: code.trim().toUpperCase(), daysPerYear: Number(days || 0), paid, active };
  return (
    <Modal open onClose={close} width={440} title={type ? "Edit leave type" : "New leave type"}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => (type ? api.patch(`/hr/leave-types/${type.id}`, body) : api.post("/hr/leave-types", body)))} label={type ? "Save" : "Create"} loading={loading} disabled={name.trim().length < 2 || code.trim().length < 1} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_110px] gap-3">
          {field("Name", <FormInput value={name} onChange={setName} placeholder="Maternity leave" />)}
          {field("Code", <FormInput value={code} onChange={setCode} placeholder="ML" />)}
        </div>
        {field("Days a year", <FormInput type="number" min="0" value={days} onChange={setDays} />, "0 means no limit.")}
        <label className={checkRow}><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Paid — payroll doesn&apos;t deduct it</label>
        {type && <label className={checkRow}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Available for new requests</label>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

// ── Shifts and the roster ────────────────────────────────────────────────────

export function ShiftDialog({ shift, onClose }: { shift?: HrShiftDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [name, setName] = useState(shift?.name ?? "");
  const [code, setCode] = useState(shift?.code ?? "");
  const [start, setStart] = useState(shift?.start ?? "09:00");
  const [end, setEnd] = useState(shift?.end ?? "17:00");
  const [active, setActive] = useState(shift?.active ?? true);
  const body = { name: name.trim(), code: code.trim().toUpperCase(), start, end, active };
  return (
    <Modal open onClose={close} width={440} title={shift ? "Edit shift" : "New shift"} subtitle="A shift that ends before it starts runs past midnight."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => (shift ? api.patch(`/hr/shifts/${shift.id}`, body) : api.post("/hr/shifts", body)))} label={shift ? "Save" : "Create"} loading={loading} disabled={name.trim().length < 2 || code.trim().length < 1 || !start || !end} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_90px] gap-3">
          {field("Name", <FormInput value={name} onChange={setName} placeholder="Morning" />)}
          {field("Code", <FormInput value={code} onChange={setCode} placeholder="M" />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Starts", <FormInput type="time" value={start} onChange={setStart} />)}
          {field("Ends", <FormInput type="time" value={end} onChange={setEnd} />)}
        </div>
        {shift && <label className={checkRow}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> In use (can be given on the roster)</label>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function CopyWeekDialog({ weekFrom, onClose }: { weekFrom: string; onClose: () => void }) {
  const { loading, error, close, run } = useAction(onClose);
  const [source, setSource] = useState(addDaysIso(weekFrom, -7));
  const [result, setResult] = useState<{ copied: number; skippedExisting: number; skippedLeave: number } | null>(null);
  async function copy() {
    try { setResult(await run(() => api.post<{ copied: number; skippedExisting: number; skippedLeave: number }>("/hr/roster/copy", { fromStart: weekStart(source), toStart: weekFrom }))); } catch { /* shown as the error */ }
  }
  return (
    <Modal open onClose={close} width={440} title="Copy a week" subtitle={`Fill the week of ${weekFrom} from another week's shifts. Days already filled and days on leave are left alone.`}
      footer={result ? <DialogButtons onCancel={close} onConfirm={close} label="Done" /> : <DialogButtons onCancel={close} onConfirm={copy} label="Copy shifts" loading={loading} disabled={!source} />}>
      <div className="flex flex-col gap-4">
        {field("Copy from the week of", <FormInput type="date" value={source} onChange={setSource} />, "Any day in that week works.")}
        {result && <p role="status" className="rounded-[8px] bg-[#dffff3] px-3 py-2 text-[13px] text-[#0b7a47]">Copied {result.copied} {result.copied === 1 ? "shift" : "shifts"}{result.skippedExisting + result.skippedLeave > 0 ? ` · skipped ${result.skippedExisting} already filled, ${result.skippedLeave} on leave` : ""}.</p>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

// ── Payroll ──────────────────────────────────────────────────────────────────

export function SalaryDialog({ salary, onClose }: { salary: HrSalaryDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [basic, setBasic] = useState(salary.set ? String(salary.basic) : "");
  const [hra, setHra] = useState(String(salary.hra));
  const [allow, setAllow] = useState(String(salary.allowances));
  const [pf, setPf] = useState(String(salary.set ? salary.pfPercent : DEFAULT_PF_PERCENT));
  const [pt, setPt] = useState(String(salary.set ? salary.profTax : DEFAULT_PROF_TAX));
  const [other, setOther] = useState(String(salary.otherDeduction));
  const n = (s: string) => Number(s || 0);
  const gross = n(basic) + n(hra) + n(allow);
  return (
    <Modal open onClose={close} width={480} title={`Salary — ${salary.name}`} subtitle={`${salary.employeeNo} · ${salary.role}. Monthly figures. A change applies to payroll runs worked out from now on.`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.put(`/hr/salaries/${salary.staffId}`, { basic: n(basic), hra: n(hra), allowances: n(allow), pfPercent: n(pf), profTax: n(pt), otherDeduction: n(other) }))} label="Save salary" loading={loading} disabled={n(basic) <= 0} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {field("Basic (₹)", <FormInput type="number" min="0" value={basic} onChange={setBasic} />)}
          {field("HRA (₹)", <FormInput type="number" min="0" value={hra} onChange={setHra} />)}
          {field("Allowances (₹)", <FormInput type="number" min="0" value={allow} onChange={setAllow} />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("PF (% of basic)", <FormInput type="number" min="0" value={pf} onChange={setPf} />)}
          {field("Prof. tax (₹)", <FormInput type="number" min="0" value={pt} onChange={setPt} />)}
          {field("Other deduction (₹)", <FormInput type="number" min="0" value={other} onChange={setOther} />)}
        </div>
        <p className="rounded-[8px] bg-[color:var(--subtle)] px-3 py-2 text-[13px] text-[color:var(--ink)]">Gross {rupees(gross)} a month · PF {rupees((gross > 0 ? n(basic) : 0) * n(pf) / 100)}</p>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function RunPayrollDialog({ onClose, onDone }: { onClose: () => void; onDone: (run: HrPayrollRunDetailDTO) => void }) {
  const { loading, error, close, run } = useAction(onClose);
  const thisMonth = todayLocal().slice(0, 7);
  const [month, setMonth] = useState(plusDays(-new Date().getDate()).slice(0, 7));
  async function go() {
    try { const r = await run(() => api.post<HrPayrollRunDetailDTO>("/hr/payroll", { month })); onDone(r); close(); } catch { /* shown as the error */ }
  }
  return (
    <Modal open onClose={close} width={440} title="Run payroll" subtitle="Works out every payslip for the month from salaries, approved unpaid leave and joining dates. A draft can be run again until it is finalized."
      footer={<DialogButtons onCancel={close} onConfirm={go} label="Work out payslips" busyLabel="Working…" loading={loading} disabled={!month || month > thisMonth} />}>
      <div className="flex flex-col gap-4">
        {field("Month", <FormInput type="month" value={month} max={thisMonth} onChange={setMonth} />, month ? monthLabel(month) : undefined)}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function AdjustPayslipDialog({ slip, onClose }: { slip: HrPayslipDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [lop, setLop] = useState(String(slip.lopAdjust));
  const [other, setOther] = useState(String(slip.otherDeduction));
  return (
    <Modal open onClose={close} width={460} title={`Adjust payslip — ${slip.staffName}`} subtitle={`${monthLabel(slip.month)} · ${slip.paidDays} of ${slip.monthDays} days paid`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.patch(`/hr/payslips/${slip.id}`, { lopAdjust: Number(lop || 0), otherDeduction: Number(other || 0) }))} label="Save" loading={loading} />}>
      <div className="flex flex-col gap-4">
        {slip.absentDays > 0 && <p role="status" className="rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[13px] text-[#8a5300]">The attendance register shows {slip.absentDays} {slip.absentDays === 1 ? "day" : "days"} with no punch and no leave. That includes weekly offs, so none of it is deducted automatically — enter the days to dock below.</p>}
        {field("Extra loss-of-pay days", <FormInput type="number" min="0" value={lop} onChange={setLop} />, `Already deducted for approved unpaid leave: ${slip.unpaidLeaveDays} ${slip.unpaidLeaveDays === 1 ? "day" : "days"}.`)}
        {field("Other deduction this month (₹)", <FormInput type="number" min="0" value={other} onChange={setOther} />, "An advance, a fine or any one-off amount.")}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
