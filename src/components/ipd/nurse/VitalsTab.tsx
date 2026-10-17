"use client";

/** Vitals round: the last readings for each patient and a row to record the next set. Out-of-range readings show red. */
import { useState } from "react";
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

const EMPTY = { tempC: "", pulse: "", sys: "", dia: "", spo2: "", resp: "" };

function Row({ p, last, canWrite, onSaved }: { p: WardPatient; last: IpdVitalDTO | undefined; canWrite: boolean; onSaved: () => void }) {
  const [f, setF] = useState(EMPTY);
  const { run, loading, error, reset } = useMutation();
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => { reset(); setF((x) => ({ ...x, [k]: e.target.value })); };
  const filled = Object.values(f).some(Boolean);
  const num = (s: string) => (s === "" ? undefined : Number(s));

  async function save() {
    if (!(await done(run(() => api.post("/ipd/nurse/vitals", {
      admissionId: p.adm.id, tempC: num(f.tempC), pulse: num(f.pulse), bpSystolic: num(f.sys), bpDiastolic: num(f.dia), spo2: num(f.spo2), respRate: num(f.resp),
    }))))) return;
    setF(EMPTY);
    onSaved();
  }

  return (
    <div className="px-4 py-[10px] border-b border-[color:var(--line)] last:border-b-0 bg-[color:var(--surface)]">
      <div className="flex items-center gap-4">
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
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <input aria-label="Temperature °C" placeholder="Temp °C" inputMode="decimal" value={f.tempC} onChange={set("tempC")} className={`${inputCls} !w-[78px]`} />
            <input aria-label="Pulse" placeholder="Pulse" inputMode="numeric" value={f.pulse} onChange={set("pulse")} className={`${inputCls} !w-[66px]`} />
            <input aria-label="Systolic" placeholder="Sys" inputMode="numeric" value={f.sys} onChange={set("sys")} className={`${inputCls} !w-[58px]`} />
            <span className="text-[color:var(--ink-soft)]">/</span>
            <input aria-label="Diastolic" placeholder="Dia" inputMode="numeric" value={f.dia} onChange={set("dia")} className={`${inputCls} !w-[58px]`} />
            <input aria-label="SpO2" placeholder="SpO₂ %" inputMode="numeric" value={f.spo2} onChange={set("spo2")} className={`${inputCls} !w-[72px]`} />
            <input aria-label="Respiratory rate" placeholder="RR" inputMode="numeric" value={f.resp} onChange={set("resp")} className={`${inputCls} !w-[58px]`} />
            <button onClick={save} disabled={!filled || loading} className={`${btn.base} ${btn.solid} ml-auto`}>{loading ? "Saving…" : "Save"}</button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-right text-[12px] text-[#c8001a]">{error.message}</p>}
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
      <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Vitals are due every 6 hours. Enter at least one reading; blood pressure needs both numbers.</p>
      {rows.length === 0 ? <Empty>No patients in this view.</Empty> : (
        <div className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {rows.map((p) => <Row key={p.adm.id} p={p} last={last.get(p.adm.id)} canWrite={canWrite} onSaved={reload} />)}
        </div>
      )}
    </div>
  );
}
