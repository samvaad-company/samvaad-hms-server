"use client";

/** Nursing care: record vitals (for now or for a reading taken earlier, one set or several), the history of readings, and this patient's nursing tasks. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { IpdNursingTaskDTO, IpdVitalDTO } from "@/types/api";
import { FormInput, FormRow } from "@/components/shared/FormRow";
import { Card, ChartCtx, ErrorLine, Pill, btn, dateTime, done, inputCls, timeOf } from "@/components/ipd/patient/ui";

const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const EMPTY = { tempC: "", pulse: "", resp: "", sys: "", dia: "", spo2: "", note: "", at: "" };
type Set = typeof EMPTY;

const out = {
  spo2: (v: IpdVitalDTO) => v.spo2 != null && v.spo2 < 94,
  temp: (v: IpdVitalDTO) => v.tempC != null && (v.tempC >= 38 || v.tempC <= 35.5),
  pulse: (v: IpdVitalDTO) => v.pulse != null && (v.pulse > 110 || v.pulse < 50),
  resp: (v: IpdVitalDTO) => v.respRate != null && (v.respRate > 24 || v.respRate < 10),
  bp: (v: IpdVitalDTO) => v.bpSystolic != null && (v.bpSystolic < 100 || v.bpSystolic > 160),
};
const flag = (bad: boolean) => (bad ? "rounded-[4px] bg-[#fff2d6] px-1 font-semibold text-[#8a5300]" : "");

function TaskSection({ ctx }: { ctx: ChartCtx }) {
  const { items: all, reload } = useList<IpdNursingTaskDTO>("/ipd/nurse/tasks", { status: "To do" });
  const tasks = all.filter((t) => t.admissionId === ctx.id);
  const { run, loading, error } = useMutation();
  const [title, setTitle] = useState("");
  const editable = ctx.canNurse && !ctx.discharged;
  async function add() {
    if (!(await done(run(() => api.post("/ipd/nurse/tasks", { admissionId: ctx.id, title: title.trim() }))))) return;
    setTitle(""); reload(); ctx.refresh();
  }
  async function finish(id: number) { if (await done(run(() => api.post(`/ipd/nurse/tasks/${id}/done`, {})))) { reload(); ctx.refresh(); } }
  return (
    <Card title="Nursing tasks" hint="Things the ward still has to do for this patient">
      {editable && (
        <div className="mb-3 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && title.trim().length >= 2) void add(); }} placeholder="e.g. Change dressing at 4 pm" className={inputCls} />
          <button onClick={add} disabled={loading || title.trim().length < 2} className={`${btn.base} ${btn.solid}`}><Plus size={13} /> Add</button>
        </div>
      )}
      <ErrorLine error={error} />
      {tasks.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No open tasks.</p> : tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[8px] text-[13px] first:border-t-0">
          <span className="flex-1 text-[color:var(--ink)]">{t.title}</span>
          {t.dueAt && <span className={`text-[12px] ${t.overdue ? "font-medium text-[#b3001b]" : "text-[color:var(--ink-soft)]"}`}>{t.overdue ? "overdue · " : "due "}{timeOf(t.dueAt)}</span>}
          {editable && <button className={`${btn.base} ${btn.ghost}`} onClick={() => finish(t.id)}>Done</button>}
        </div>
      ))}
    </Card>
  );
}

export function NursingTab({ ctx }: { ctx: ChartCtx }) {
  const { items: vitals, reload } = useList<IpdVitalDTO>("/ipd/nurse/vitals", { admissionId: ctx.id });
  const { run, loading, error, reset } = useMutation();
  const [sets, setSets] = useState<Set[]>([{ ...EMPTY, at: localNow() }]);
  const editable = ctx.canNurse && !ctx.discharged;
  const change = (i: number, k: keyof Set) => (v: string) => { reset(); setSets((all) => all.map((x, n) => (n === i ? { ...x, [k]: v } : x))); };
  const has = (x: Set) => [x.tempC, x.pulse, x.resp, x.sys, x.dia, x.spo2].some((v) => v.trim() !== "");
  const filled = sets.filter(has);
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  async function save() {
    const readings = filled.map((x) => ({ tempC: num(x.tempC), pulse: num(x.pulse), respRate: num(x.resp), bpSystolic: num(x.sys), bpDiastolic: num(x.dia), spo2: num(x.spo2), note: x.note.trim(), recordedAt: x.at ? new Date(x.at).toISOString() : undefined }));
    if (!(await done(run(() => api.post("/ipd/nurse/vitals", { admissionId: ctx.id, readings }))))) return;
    setSets([{ ...EMPTY, at: localNow() }]);
    reload(); ctx.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {editable && (
        <Card title="Record vitals" hint="Set the time if the reading was taken earlier. Add more sets to enter several at once.">
          <div className="flex flex-col gap-3">
            {sets.map((s, i) => (
              <div key={i} className="rounded-[10px] border border-[color:var(--line)] p-3">
                <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 xl:grid-cols-8">
                  <div className="col-span-2"><FormRow label="Reading taken at"><input type="datetime-local" value={s.at} max={localNow()} onChange={(e) => change(i, "at")(e.target.value)} className={`${inputCls} !h-[42px]`} /></FormRow></div>
                  <FormRow label="Temp (°C)"><FormInput type="number" value={s.tempC} onChange={change(i, "tempC")} /></FormRow>
                  <FormRow label="Pulse"><FormInput type="number" value={s.pulse} onChange={change(i, "pulse")} /></FormRow>
                  <FormRow label="Resp"><FormInput type="number" value={s.resp} onChange={change(i, "resp")} /></FormRow>
                  <FormRow label="BP sys"><FormInput type="number" value={s.sys} onChange={change(i, "sys")} /></FormRow>
                  <FormRow label="BP dia"><FormInput type="number" value={s.dia} onChange={change(i, "dia")} /></FormRow>
                  <FormRow label="SpO₂ %"><FormInput type="number" value={s.spo2} onChange={change(i, "spo2")} /></FormRow>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input value={s.note} onChange={(e) => change(i, "note")(e.target.value)} placeholder="Note (optional)" className={inputCls} />
                  {sets.length > 1 && <button type="button" aria-label="Remove set" className="cursor-pointer px-2 text-[16px] text-[color:var(--ink-soft)] hover:text-[#c8001a]" onClick={() => setSets((all) => all.filter((_, n) => n !== i))}>×</button>}
                </div>
              </div>
            ))}
            <ErrorLine error={error} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSets((all) => [...all, { ...EMPTY, at: localNow() }])} disabled={sets.length >= 24} className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline">+ Add another set</button>
              <button onClick={save} disabled={loading || filled.length === 0} className={`${btn.base} ${btn.solid} ml-auto`}>{loading ? "Saving…" : filled.length > 1 ? `Add ${filled.length} sets` : "Add vitals"}</button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Vitals" hint={`${vitals.length} ${vitals.length === 1 ? "reading" : "readings"} — newest first; out-of-range values are highlighted`}>
        {vitals.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No vitals charted yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead><tr className="border-b border-[color:var(--line)] text-[11px] uppercase tracking-wide text-[color:var(--ink-soft)]">{["Time", "Temp", "Pulse", "Resp", "BP", "SpO₂", "By"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {vitals.map((v) => (
                  <tr key={v.id} className="border-b border-[color:var(--subtle-2)] last:border-b-0">
                    <td className="px-2 py-2 text-[color:var(--ink)]">{dateTime(v.recordedAt)}{v.note ? <span className="ml-2 text-[11px] text-[color:var(--ink-soft)]">“{v.note}”</span> : null}</td>
                    <td className="px-2 py-2"><span className={flag(out.temp(v))}>{v.tempC != null ? `${v.tempC}°C` : "–"}</span></td>
                    <td className="px-2 py-2"><span className={flag(out.pulse(v))}>{v.pulse ?? "–"}</span></td>
                    <td className="px-2 py-2"><span className={flag(out.resp(v))}>{v.respRate ?? "–"}</span></td>
                    <td className="px-2 py-2"><span className={flag(out.bp(v))}>{v.bpSystolic != null ? `${v.bpSystolic}/${v.bpDiastolic}` : "–"}</span></td>
                    <td className="px-2 py-2"><span className={flag(out.spo2(v))}>{v.spo2 ?? "–"}</span></td>
                    <td className="px-2 py-2 text-[12px] text-[color:var(--ink-soft)]">{v.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vitals.length >= 30 && <p className="pt-2 text-[11px] text-[color:var(--ink-soft)]"><Pill>latest 30 shown</Pill></p>}
          </div>
        )}
      </Card>

      <TaskSection ctx={ctx} />
    </div>
  );
}
