"use client";

/** IV & I/O: the drips running on this patient, and the intake and output chart that gives the fluid balance. */
import { useState } from "react";
import { Droplets, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import type { IpdIoSummaryDTO, IpdIvLineDTO } from "@/types/api";
import { FormInput, FormRow } from "@/components/shared/FormRow";
import { Card, ChartCtx, ErrorLine, Pill, Stat, btn, dayName, done, inputCls, timeOf } from "@/components/ipd/patient/ui";

const IN_KINDS = ["Oral", "IV fluids", "Tube feed", "Blood"];
const OUT_KINDS = ["Urine", "Stool", "Vomit", "Drain", "NG aspirate"];
const AMOUNTS = [50, 100, 150, 200, 250, 300, 500];

/** "2026-11-11T20:20" in local time, for a datetime-local box. */
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function IvSection({ ctx }: { ctx: ChartCtx }) {
  const { items: all, reload } = useList<IpdIvLineDTO>("/ipd/nurse/iv");
  const lines = all.filter((l) => l.admissionId === ctx.id);
  const running = lines.filter((l) => l.status === "Running");
  const { run, loading, error, reset } = useMutation();
  const [f, setF] = useState({ fluid: "", volumeMl: "500", rateMlHr: "100" });
  const editable = ctx.canNurse && !ctx.discharged;

  async function start() {
    if (!(await done(run(() => api.post("/ipd/nurse/iv", { admissionId: ctx.id, fluid: f.fluid.trim(), volumeMl: Number(f.volumeMl), rateMlHr: Number(f.rateMlHr) }))))) return;
    setF({ fluid: "", volumeMl: "500", rateMlHr: "100" });
    reload(); ctx.refresh();
  }
  async function stop(id: number, completed: boolean) {
    if (await done(run(() => api.post(`/ipd/nurse/iv/${id}/stop`, { completed })))) { reload(); ctx.refresh(); }
  }

  return (
    <Card title="IV fluids" hint={running.length ? `${running.length} running` : "No IV running right now"}>
      <div className="flex flex-col gap-3">
        {running.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[#b5d4f7] bg-[#eef6ff] px-3 py-2">
            <Droplets size={16} className="text-[#0b4fa3]" />
            <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-[color:var(--ink)]">{l.fluid} · {l.volumeMl} mL at {l.rateMlHr} mL/hr</p><p className="text-[12px] text-[color:var(--ink-soft)]">Started {timeOf(l.startedAt)} by {l.startedBy} · runs dry about {timeOf(l.endsAt)}</p></div>
            {editable && <><button className={`${btn.base} ${btn.ghost}`} onClick={() => stop(l.id, true)}>Completed</button><button className={`${btn.base} ${btn.ghost}`} onClick={() => stop(l.id, false)}>Stop</button></>}
          </div>
        ))}
        {editable && (
          <div className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <FormRow label="Fluid"><FormInput placeholder="e.g. Normal saline 0.9%" value={f.fluid} onChange={(v) => { reset(); setF((x) => ({ ...x, fluid: v })); }} /></FormRow>
            <FormRow label="Volume (mL)"><FormInput type="number" value={f.volumeMl} onChange={(v) => setF((x) => ({ ...x, volumeMl: v }))} /></FormRow>
            <FormRow label="Rate (mL/hr)"><FormInput type="number" value={f.rateMlHr} onChange={(v) => setF((x) => ({ ...x, rateMlHr: v }))} /></FormRow>
            <button onClick={start} disabled={loading || !f.fluid.trim() || Number(f.volumeMl) <= 0 || Number(f.rateMlHr) <= 0} className={`${btn.base} ${btn.solid} h-[42px]`}>Start IV</button>
          </div>
        )}
        <ErrorLine error={error} />
        {lines.filter((l) => l.status !== "Running").length > 0 && (
          <div className="text-[12px] text-[color:var(--ink-soft)]">
            <p className="mb-1 font-medium text-[color:var(--ink)]">Earlier bottles</p>
            {lines.filter((l) => l.status !== "Running").slice(0, 6).map((l) => <p key={l.id}>{l.fluid} · {l.volumeMl} mL · {l.status.toLowerCase()} {l.stoppedAt ? timeOf(l.stoppedAt) : ""}</p>)}
          </div>
        )}
      </div>
    </Card>
  );
}

export function IvIoTab({ ctx }: { ctx: ChartCtx }) {
  const { item: io, reload } = useItem<IpdIoSummaryDTO>(`/ipd/${ctx.id}/io`);
  const { run, loading, error, reset } = useMutation();
  const [kind, setKind] = useState<"In" | "Out">("In");
  const [category, setCategory] = useState("Oral");
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState(localNow());
  const [note, setNote] = useState("");
  const editable = ctx.canNurse && !ctx.discharged;
  const kinds = kind === "In" ? IN_KINDS : OUT_KINDS;

  async function save() {
    if (!(await done(run(() => api.post(`/ipd/${ctx.id}/io`, { kind, category, amountMl: Number(amount), note: note.trim(), recordedAt: new Date(when).toISOString() }))))) return;
    setAmount(""); setNote(""); setWhen(localNow());
    reload(); ctx.refresh();
  }
  async function remove(id: number) {
    if (await done(run(() => api.del(`/ipd/${ctx.id}/io/${id}`)))) reload();
  }

  const days: { day: string; entries: IpdIoSummaryDTO["entries"] }[] = [];
  for (const e of io?.entries ?? []) {
    const day = e.recordedAt.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(e); else days.push({ day, entries: [e] });
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <IvSection ctx={ctx} />

      <Card title="Intake & output" hint="Fluid balance over the last 24 hours">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="In, last 24 h" value={`${io?.intakeMl ?? 0} mL`} />
          <Stat label="Out, last 24 h" value={`${io?.outputMl ?? 0} mL`} />
          <Stat label="Balance" value={`${(io?.balanceMl ?? 0) > 0 ? "+" : ""}${io?.balanceMl ?? 0} mL`} tone={Math.abs(io?.balanceMl ?? 0) > 1500 ? "warn" : undefined} />
        </div>

        {editable && (
          <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[color:var(--line)] p-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => { setKind("In"); setCategory("Oral"); reset(); }} className={`${btn.base} ${kind === "In" ? btn.solid : btn.ghost}`}>In (given)</button>
              <button type="button" onClick={() => { setKind("Out"); setCategory("Urine"); reset(); }} className={`${btn.base} ${kind === "Out" ? btn.solid : btn.ghost}`}>Out (passed)</button>
              <div className="ml-2 flex flex-wrap gap-2">{kinds.map((k) => <button key={k} type="button" onClick={() => setCategory(k)} className={`${btn.base} ${category === k ? "border border-[color:var(--brand)] text-[color:var(--brand)]" : btn.ghost}`}>{k}</button>)}</div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[120px]"><FormRow label="Amount (mL)"><FormInput type="number" value={amount} onChange={(v) => { reset(); setAmount(v); }} placeholder="mL" /></FormRow></div>
              <div className="flex flex-wrap gap-1 pb-[6px]">{AMOUNTS.map((a) => <button key={a} type="button" onClick={() => setAmount(String(a))} className={`${btn.base} ${btn.ghost} !px-2`}>{a}</button>)}</div>
              <div className="w-[200px]"><FormRow label="When"><input type="datetime-local" value={when} max={localNow()} onChange={(e) => setWhen(e.target.value)} className={`${inputCls} !h-[42px]`} /></FormRow></div>
              <div className="min-w-[160px] flex-1"><FormRow label="Note"><FormInput value={note} onChange={setNote} placeholder="optional" /></FormRow></div>
              <button onClick={save} disabled={loading || !(Number(amount) > 0)} className={`${btn.base} ${btn.solid} h-[42px]`}>{loading ? "Saving…" : "Save"}</button>
            </div>
            <ErrorLine error={error} />
          </div>
        )}

        {days.length === 0 ? <p className="py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing charted yet.</p> : days.map((d) => {
          const inn = d.entries.filter((e) => e.kind === "In").reduce((n, e) => n + e.amountMl, 0);
          const out = d.entries.filter((e) => e.kind === "Out").reduce((n, e) => n + e.amountMl, 0);
          return (
            <div key={d.day} className="mb-3 last:mb-0">
              <p className="mb-1 text-[12px] font-medium text-[color:var(--ink)]">{dayName(`${d.day}T12:00:00`)} <span className="font-normal text-[color:var(--ink-soft)]">· in {inn} mL · out {out} mL · balance {inn - out > 0 ? "+" : ""}{inn - out}</span></p>
              <div className="overflow-hidden rounded-[8px] border border-[color:var(--line)]">
                {d.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 border-b border-[color:var(--subtle-2)] px-3 py-[7px] text-[13px] last:border-b-0">
                    <span className="w-[64px] shrink-0 text-[12px] text-[color:var(--ink-soft)]">{timeOf(e.recordedAt)}</span>
                    <Pill tone={e.kind === "In" ? "info" : "warn"}>{e.kind === "In" ? "In" : "Out"}</Pill>
                    <span className="flex-1 text-[color:var(--ink)]">{e.category}{e.note ? <span className="text-[color:var(--ink-soft)]"> — {e.note}</span> : null}</span>
                    <span className="font-mono text-[12px]">{e.amountMl} mL</span>
                    <span className="hidden w-[110px] truncate text-right text-[11px] text-[color:var(--ink-soft)] sm:block">{e.recordedBy}</span>
                    {editable && <button aria-label="Delete entry" onClick={() => remove(e.id)} className="cursor-pointer text-[#c8c8cc] hover:text-[#ff0004]"><Trash2 size={13} /></button>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
