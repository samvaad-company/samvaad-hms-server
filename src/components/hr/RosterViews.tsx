"use client";

/** Roster tabs: the weekly grid (one shift per person per day), the duty list for a day, and the shift definitions. */
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import type { HrDutyListDTO, HrRosterDTO, HrShiftDTO } from "@/types/api";
import { dmy, Empty, ErrorNote, outlineBtn, Pill, primaryBtn, td, th, todayLocal } from "@/components/mrd/shared";
import { FormSelect } from "@/components/shared/FormRow";
import { addDaysIso, attempt, clock12, isWeekend, Stepper, useActiveStaff, weekdayOf, weekStart } from "@/components/hr/shared";
import { CopyWeekDialog, ShiftDialog } from "@/components/hr/HrDialogs";

const SHIFT_TONES = ["bg-[#e3efff] text-[#0a5fc4]", "bg-[#fff2d6] text-[#8a5300]", "bg-[#ece5ff] text-[#5a2fc2]", "bg-[#dffff3] text-[#0b7a47]", "bg-[#ffe3e5] text-[#b3001b]", "bg-[#e6f7fb] text-[#0a6f86]"];
export const shiftTone = (shifts: HrShiftDTO[], id: number) => SHIFT_TONES[Math.max(0, shifts.findIndex((s) => s.id === id)) % SHIFT_TONES.length];

// ── Weekly grid ──────────────────────────────────────────────────────────────

export function RosterView({ canWrite, shifts }: { canWrite: boolean; shifts: HrShiftDTO[] }) {
  const staff = useActiveStaff();
  const [from, setFrom] = useState(weekStart(todayLocal()));
  const [dept, setDept] = useState("");
  const [copying, setCopying] = useState(false);
  const to = addDaysIso(from, 6);
  const { item: roster, reload } = useItem<HrRosterDTO>(`/hr/roster?from=${from}&to=${to}`);
  const { run, error, reset } = useMutation();
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(from, i));
  const today = todayLocal();
  const oldest = addDaysIso(today, -7);

  const shiftAt = useMemo(() => new Map((roster?.entries ?? []).map((e) => [`${e.staffId}|${e.date}`, e.shiftId])), [roster]);
  const leaveAt = useMemo(() => new Map((roster?.leaveDays ?? []).map((l) => [`${l.staffId}|${l.date}`, l.code])), [roster]);
  const depts = useMemo(() => [...new Set(staff.map((s) => s.department).filter(Boolean))].sort(), [staff]);
  const rows = dept ? staff.filter((s) => s.department === dept) : staff;
  const active = shifts.filter((s) => s.active);

  const counts = days.map((d) => rows.filter((s) => shiftAt.has(`${s.id}|${d}`)).length);

  async function assign(staffId: number, date: string, value: string) {
    reset();
    await attempt(run(() => api.put("/hr/roster", { staffId, date, shiftId: value ? Number(value) : null })));
    reload();
  }

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Stepper label={`${dmy(from)} – ${dmy(to)}`} onPrev={() => setFrom(addDaysIso(from, -7))} onNext={() => setFrom(addDaysIso(from, 7))} />
        <button onClick={() => setFrom(weekStart(today))} className={outlineBtn + " !h-[32px]"}>This week</button>
        <div className="w-[190px]"><FormSelect value={dept} onChange={setDept} placeholder="All departments" options={[{ value: "", label: "All departments" }, ...depts.map((d) => ({ value: d, label: d }))]} /></div>
        {canWrite && <button onClick={() => setCopying(true)} className={outlineBtn + " ml-auto !h-[36px]"}>Copy from another week</button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {active.map((s) => <span key={s.id} className={`rounded-full px-[10px] py-[1px] text-[12px] ${shiftTone(shifts, s.id)}`}>{s.code} · {s.name} {clock12(s.start)}–{clock12(s.end)}</span>)}
      </div>
      <div className="mt-3"><ErrorNote message={error?.message} /></div>
      {rows.length === 0 ? <Empty>No staff to roster.</Empty> : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">
                <th className={`${th} sticky left-0 z-10 min-w-[200px] bg-[color:var(--faint)]`}>Staff</th>
                {days.map((d) => (
                  <th key={d} className={`${th} min-w-[104px] text-center ${d === today ? "!text-[color:var(--brand)]" : ""}`}>
                    {weekdayOf(d)} <span className="font-normal text-[color:var(--ink-soft)]">{Number(d.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-[color:var(--line)] last:border-b-0">
                  <td className={`${td} sticky left-0 bg-[color:var(--surface)]`}><p className="font-medium">{s.name}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{s.role}{s.department ? ` · ${s.department}` : ""}</p></td>
                  {days.map((d) => {
                    const key = `${s.id}|${d}`;
                    const leave = leaveAt.get(key);
                    const current = shiftAt.get(key);
                    return (
                      <td key={d} className={`p-[6px] text-center ${isWeekend(d) ? "bg-[color:var(--faint)]" : ""}`}>
                        {leave ? (
                          <span title="On approved leave" className="inline-block rounded-[6px] bg-[#fff2d6] px-2 py-[5px] text-[12px] text-[#8a5300]">Leave · {leave}</span>
                        ) : canWrite && d >= oldest ? (
                          <select aria-label={`${s.name}, ${d}`} value={current ? String(current) : ""} onChange={(e) => assign(s.id, d, e.target.value)}
                            className={`h-[32px] w-full cursor-pointer rounded-[6px] border border-[color:var(--line)] px-1 text-center text-[13px] focus:border-[color:var(--brand)] focus:outline-none ${current ? shiftTone(shifts, current) : "bg-[color:var(--surface)] text-[color:var(--ink-soft)]"}`}>
                            <option value="">—</option>
                            {shifts.filter((x) => x.active || x.id === current).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                          </select>
                        ) : (
                          current ? <span className={`inline-block rounded-[6px] px-2 py-[5px] text-[12px] ${shiftTone(shifts, current)}`}>{shifts.find((x) => x.id === current)?.code ?? "?"}</span> : <span className="text-[color:var(--ink-soft)]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[color:var(--line)] bg-[color:var(--faint)]">
                <td className={`${td} sticky left-0 bg-[color:var(--faint)] text-[12px] text-[color:var(--ink-soft)]`}>On duty</td>
                {counts.map((c, i) => <td key={i} className={`${td} text-center font-mono`}>{c}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {copying && <CopyWeekDialog weekFrom={from} onClose={() => { setCopying(false); reload(); }} />}
    </div>
  );
}

// ── Duty list ────────────────────────────────────────────────────────────────

export function DutyListView({ shifts }: { shifts: HrShiftDTO[] }) {
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const { item: duty, loading } = useItem<HrDutyListDTO>(`/hr/roster/duty?date=${date}`);
  const total = duty?.shifts.reduce((n, s) => n + s.count, 0) ?? 0;
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Stepper label={date === today ? `Today · ${dmy(date)}` : dmy(date)} onPrev={() => setDate(addDaysIso(date, -1))} onNext={() => setDate(addDaysIso(date, 1))} />
        <button onClick={() => setDate(today)} className={outlineBtn + " !h-[32px]"}>Today</button>
        {duty && <span className="text-[13px] text-[color:var(--ink-soft)]">{total} on duty · {duty.onLeave.length} on leave · {duty.unrostered} without a shift</span>}
      </div>
      {!duty ? <Empty>{loading ? "Loading…" : "Nothing to show."}</Empty> : (
        <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {duty.shifts.map((s) => (
            <section key={s.shift.id} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
              <header className="flex items-center gap-2 border-b border-[color:var(--line)] px-4 py-3">
                <span className={`rounded-full px-[10px] py-[1px] text-[12px] font-medium ${shiftTone(shifts, s.shift.id)}`}>{s.shift.code}</span>
                <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">{s.shift.name}</h3>
                <span className="text-[12px] text-[color:var(--ink-soft)]">{clock12(s.shift.start)}–{clock12(s.shift.end)}</span>
                <span className="ml-auto font-mono text-[14px] font-bold">{s.count}</span>
              </header>
              <div className="px-4 py-3">
                {s.count === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No one rostered.</p> : s.departments.map((d) => (
                  <div key={d.department} className="mb-3 last:mb-0">
                    <p className="text-[12px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{d.department}</p>
                    <ul className="mt-1 text-[14px] text-[color:var(--ink)]">{d.staff.map((p) => <li key={p.id} className="flex justify-between gap-2 py-[2px]"><span>{p.name}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{p.role}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <section className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
            <header className="flex items-center gap-2 border-b border-[color:var(--line)] px-4 py-3"><Pill tone="amber">Leave</Pill><h3 className="text-[14px] font-semibold text-[color:var(--ink)]">On leave</h3><span className="ml-auto font-mono text-[14px] font-bold">{duty.onLeave.length}</span></header>
            <div className="px-4 py-3">
              {duty.onLeave.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No one is on leave.</p> : (
                <ul className="text-[14px]">{duty.onLeave.map((p) => <li key={p.id} className="flex justify-between gap-2 py-[2px]"><span>{p.name}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{p.code} · {p.department}</span></li>)}</ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ── Shifts ───────────────────────────────────────────────────────────────────

export function ShiftsView({ canWrite, shifts, reload }: { canWrite: boolean; shifts: HrShiftDTO[]; reload: () => void }) {
  const [editing, setEditing] = useState<HrShiftDTO | "new" | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      {canWrite && <div className="mb-3 flex justify-end"><button onClick={() => setEditing("new")} className={primaryBtn}>+ New shift</button></div>}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[520px] text-left">
          <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Shift", "Code", "Hours", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} font-medium`}>{s.name}</td>
                <td className={td}><span className={`rounded-full px-[10px] py-[1px] text-[12px] ${shiftTone(shifts, s.id)}`}>{s.code}</span></td>
                <td className={td}>{clock12(s.start)} – {clock12(s.end)}{s.end <= s.start ? <span className="ml-2 text-[12px] text-[color:var(--ink-soft)]">next day</span> : null}</td>
                <td className={td}><Pill tone={s.active ? "green" : "grey"}>{s.active ? "In use" : "Not in use"}</Pill></td>
                <td className={`${td} text-right`}>{canWrite && <button onClick={() => setEditing(s)} className={outlineBtn}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ShiftDialog shift={editing === "new" ? undefined : editing} onClose={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

export function useShifts() {
  return useList<HrShiftDTO>("/hr/shifts");
}
