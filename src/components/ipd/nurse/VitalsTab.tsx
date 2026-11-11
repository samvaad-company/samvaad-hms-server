"use client";

/** Vitals round: the last readings for each patient and a row to record the next set. Out-of-range readings show red. */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { IpdVitalDTO } from "@/types/api";
import { btn, clock, Empty, inputCls, PatientCell, useAutoRefresh, type WardPatient, done } from "@/components/ipd/nurse/shared";

const bad = (v: IpdVitalDTO | undefined, f: "spo2" | "temp" | "pulse" | "bp" | "resp"): boolean => {
  if (!v) return false;
  if (f === "spo2") return v.spo2 != null && v.spo2 < 90;
  if (f === "temp") return v.tempC != null && (v.tempC >= 39.5 || v.tempC <= 35);
  if (f === "pulse") return v.pulse != null && (v.pulse > 130 || v.pulse < 40);
  if (f === "bp") return v.bpSystolic != null && (v.bpSystolic < 90 || v.bpSystolic > 200);
  return v.respRate != null && (v.respRate > 30 || v.respRate < 8);
};
const red = "text-[#c8001a] font-semibold";

const EMPTY = { tempC: "", pulse: "", sys: "", dia: "", spo2: "", resp: "", note: "", time: "" };
type SetForm = typeof EMPTY;

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Every set taken for one patient, newest first by day: vitals can be taken as often as needed and none is overwritten. */
function History({ admissionId, version }: { admissionId: number; version: number }) {
  const { items, reload } = useList<IpdVitalDTO>("/ipd/nurse/vitals", { admissionId, v: version });
  void reload;
  if (items.length === 0) return <p className="py-2 text-[12px] text-[color:var(--ink-soft)]">No readings yet.</p>;
  let lastDay = "";
  return (
    <div className="mt-2 overflow-hidden rounded-[8px] border border-[color:var(--line)]">
      {items.map((v) => {
        const day = dayOf(v.recordedAt), head = day !== lastDay;
        lastDay = day;
        return (
          <div key={v.id}>
            {head && <p className="bg-[color:var(--subtle)] px-3 py-[4px] text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-soft)]">{day}</p>}
            <div className="flex flex-wrap items-baseline gap-x-4 border-t border-[color:var(--subtle-2)] px-3 py-[6px] text-[12px] first:border-t-0">
              <span className="w-[64px] shrink-0 font-medium">{clock(v.recordedAt)}</span>
              <span className="font-mono">
                <span className={bad(v, "temp") ? red : ""}>{v.tempC ?? "–"}°</span> · P <span className={bad(v, "pulse") ? red : ""}>{v.pulse ?? "–"}</span> ·{" "}
                BP <span className={bad(v, "bp") ? red : ""}>{v.bpSystolic ?? "–"}/{v.bpDiastolic ?? "–"}</span> · SpO₂ <span className={bad(v, "spo2") ? red : ""}>{v.spo2 ?? "–"}</span> · RR <span className={bad(v, "resp") ? red : ""}>{v.respRate ?? "–"}</span>
              </span>
              {v.note && <span className="text-[color:var(--ink-soft)]">“{v.note}”</span>}
              <span className="ml-auto text-[11px] text-[color:var(--ink-soft)]">{v.recordedBy}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Today at HH:MM (local) as an ISO time; empty means "now", which the server fills in. */
const atTime = (hhmm: string): string | undefined => {
  if (!hhmm) return undefined;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

function Row({ p, last, canWrite, onSaved }: { p: WardPatient; last: IpdVitalDTO | undefined; canWrite: boolean; onSaved: () => void }) {
  const [sets, setSets] = useState<SetForm[]>([EMPTY]);
  const [showAll, setShowAll] = useState(false);
  const [saves, setSaves] = useState(0);
  const { run, loading, error, reset } = useMutation();
  const change = (i: number, k: keyof SetForm) => (e: React.ChangeEvent<HTMLInputElement>) => { reset(); setSets((all) => all.map((x, n) => (n === i ? { ...x, [k]: e.target.value } : x))); };
  const hasReading = (x: SetForm) => [x.tempC, x.pulse, x.sys, x.dia, x.spo2, x.resp].some(Boolean);
  const filled = sets.filter(hasReading);
  const num = (v: string) => (v === "" ? undefined : Number(v));

  async function save() {
    const readings = filled.map((x) => ({ tempC: num(x.tempC), pulse: num(x.pulse), bpSystolic: num(x.sys), bpDiastolic: num(x.dia), spo2: num(x.spo2), respRate: num(x.resp), note: x.note.trim(), recordedAt: atTime(x.time) }));
    if (!(await done(run(() => api.post("/ipd/nurse/vitals", { admissionId: p.adm.id, readings }))))) return;
    setSets([EMPTY]);
    setSaves((n) => n + 1);
    onSaved();
  }

  return (
    <div className="px-4 py-[10px] border-b border-[color:var(--line)] last:border-b-0 bg-[color:var(--surface)]">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-[220px] shrink-0"><PatientCell adm={p.adm} /></div>
        <div className="w-[260px] shrink-0 text-[12px] leading-[17px] text-[color:var(--ink)]">
          {last ? (
            <>
              <p className="font-mono">
                <span className={bad(last, "temp") ? red : ""}>{last.tempC ?? "–"}°</span> · P <span className={bad(last, "pulse") ? red : ""}>{last.pulse ?? "–"}</span> ·{" "}
                BP <span className={bad(last, "bp") ? red : ""}>{last.bpSystolic ?? "–"}/{last.bpDiastolic ?? "–"}</span> · SpO₂ <span className={bad(last, "spo2") ? red : ""}>{last.spo2 ?? "–"}</span> · RR <span className={bad(last, "resp") ? red : ""}>{last.respRate ?? "–"}</span>
              </p>
              <p className="text-[11px] text-[color:var(--ink-soft)]">{clock(last.recordedAt)} · {last.recordedBy}{p.live?.vitalsDue && <span className="ml-1 rounded-full border border-[#f3cf7d] bg-[#fff2d6] px-[6px] text-[#8a5300]">due</span>}</p>
            </>
          ) : <p className="text-[color:var(--ink-soft)]">No vitals yet <span className="ml-1 rounded-full border border-[#f3cf7d] bg-[#fff2d6] px-[6px] text-[11px] text-[#8a5300]">due</span></p>}
        </div>
        {canWrite && (
          <div className="flex min-w-[300px] flex-1 flex-col gap-2">
            {sets.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input aria-label="Temperature °C" placeholder="Temp °C" inputMode="decimal" value={f.tempC} onChange={change(i, "tempC")} className={`${inputCls} !w-[78px]`} />
                <input aria-label="Pulse" placeholder="Pulse" inputMode="numeric" value={f.pulse} onChange={change(i, "pulse")} className={`${inputCls} !w-[66px]`} />
                <input aria-label="Systolic" placeholder="Sys" inputMode="numeric" value={f.sys} onChange={change(i, "sys")} className={`${inputCls} !w-[58px]`} />
                <span className="text-[color:var(--ink-soft)]">/</span>
                <input aria-label="Diastolic" placeholder="Dia" inputMode="numeric" value={f.dia} onChange={change(i, "dia")} className={`${inputCls} !w-[58px]`} />
                <input aria-label="SpO2" placeholder="SpO₂ %" inputMode="numeric" value={f.spo2} onChange={change(i, "spo2")} className={`${inputCls} !w-[72px]`} />
                <input aria-label="Respiratory rate" placeholder="RR" inputMode="numeric" value={f.resp} onChange={change(i, "resp")} className={`${inputCls} !w-[58px]`} />
                <input aria-label="Time taken (leave empty for now)" title="Time taken today — leave empty for now" type="time" value={f.time} onChange={change(i, "time")} className={`${inputCls} !w-[104px]`} />
                <input aria-label="Note" placeholder="Note (optional)" value={f.note} onChange={change(i, "note")} className={`${inputCls} min-w-[120px] flex-1`} />
                {sets.length > 1 && (
                  <button type="button" aria-label={`Remove set ${i + 1}`} onClick={() => setSets((all) => all.filter((_, n) => n !== i))} className="cursor-pointer px-1 text-[16px] leading-none text-[color:var(--ink-soft)] hover:text-[#c8001a]">×</button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSets((all) => [...all, EMPTY])} disabled={sets.length >= 24} className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline disabled:opacity-50">+ Add another set</button>
              <button onClick={save} disabled={filled.length === 0 || loading} className={`${btn.base} ${btn.solid} ml-auto`}>
                {loading ? "Saving…" : filled.length > 1 ? `Save ${filled.length} sets` : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-right text-[12px] text-[#c8001a]">{error.message}</p>}
      <button type="button" onClick={() => setShowAll((o) => !o)} aria-expanded={showAll} className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[12px] text-[color:var(--brand)] hover:underline">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} aria-hidden /> {showAll ? "Hide all readings" : "All readings"}
      </button>
      {showAll && <History admissionId={p.adm.id} version={saves} />}
    </div>
  );
}

export function VitalsTab({ patients, canWrite }: { patients: WardPatient[]; canWrite: boolean }) {
  const { items: latest, reload } = useList<IpdVitalDTO>("/ipd/nurse/vitals");
  useAutoRefresh(reload);
  const last = new Map(latest.map((v) => [v.admissionId, v]));
  // Patients who are due come first.
  const rows = [...patients].sort((a, b) => Number(b.live?.vitalsDue ?? false) - Number(a.live?.vitalsDue ?? false));
  return (
    <div className="p-5">
      <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Vitals are due every 6 hours, and can be taken as often as needed — each set is added, none is overwritten (see “All readings”). Use “+ Add another set” to enter several at once, and the time box if a set was taken earlier today. Blood pressure needs both numbers.</p>
      {rows.length === 0 ? <Empty>No patients in this view.</Empty> : (
        <div className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {rows.map((p) => <Row key={p.adm.id} p={p} last={last.get(p.adm.id)} canWrite={canWrite} onSaved={reload} />)}
        </div>
      )}
    </div>
  );
}
