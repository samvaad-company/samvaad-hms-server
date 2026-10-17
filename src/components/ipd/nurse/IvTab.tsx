"use client";

/** IV bottles: what is running on whom, when each runs dry, and a way to start or stop one. */
import { useState } from "react";
import { Droplets, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import type { IpdIvLineDTO } from "@/types/api";
import { btn, clock, Empty, PatientCell, useAutoRefresh, type WardPatient, done } from "@/components/ipd/nurse/shared";

function remaining(line: IpdIvLineDTO, now: number): { pct: number; label: string; over: boolean } {
  const start = new Date(line.startedAt).getTime();
  const end = new Date(line.endsAt).getTime();
  const pct = Math.max(0, Math.min(100, ((now - start) / Math.max(1, end - start)) * 100));
  const mins = Math.round((end - now) / 60_000);
  if (mins <= 0) return { pct: 100, label: "Finished", over: true };
  return { pct, label: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m left` : `${mins} min left`, over: false };
}

export function IvTab({ patients, canWrite }: { patients: WardPatient[]; canWrite: boolean }) {
  const { items: lines, reload } = useList<IpdIvLineDTO>("/ipd/nurse/iv");
  const [starting, setStarting] = useState(false);
  const [f, setF] = useState({ patient: "", fluid: "", volume: "500", rate: "100" });
  const { run, loading, error, reset } = useMutation();
  useAutoRefresh(reload);

  const byId = new Map(patients.map((p) => [p.adm.id, p.adm]));
  const shown = lines.filter((l) => byId.has(l.admissionId));
  // eslint-disable-next-line react-hooks/purity -- a clock reading for "time left"; the list refreshes every 30 s
  const now = Date.now();

  async function start() {
    if (!(await done(run(() => api.post("/ipd/nurse/iv", { admissionId: Number(f.patient), fluid: f.fluid.trim(), volumeMl: Number(f.volume), rateMlHr: Number(f.rate) }))))) return;
    setStarting(false); setF({ patient: "", fluid: "", volume: "500", rate: "100" });
    reload();
  }
  async function stop(l: IpdIvLineDTO, completed: boolean) {
    if (!(await done(run(() => api.post(`/ipd/nurse/iv/${l.id}/stop`, { completed }))))) return;
    reload();
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-[color:var(--ink-soft)]"><span className="font-semibold text-[color:var(--ink)]">{shown.length}</span> running — an alert is raised 30 minutes before a bottle finishes.</p>
        {canWrite && <button onClick={() => { setStarting(true); reset(); }} className={`${btn.base} ${btn.solid}`}><Plus size={13} /> Start IV</button>}
      </div>
      {shown.length === 0 ? <Empty>No IV bottles running.</Empty> : (
        <div className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {shown.map((l) => {
            const adm = byId.get(l.admissionId);
            const r = remaining(l, now);
            return (
              <div key={l.id} className="flex items-center gap-4 px-4 py-3 border-b border-[color:var(--line)] last:border-b-0 bg-[color:var(--surface)]">
                <Droplets size={16} className={r.over ? "text-[#c8001a]" : "text-[#0a5fc4]"} />
                <div className="w-[220px] shrink-0">{adm && <PatientCell adm={adm} />}</div>
                <div className="min-w-0 flex-1 leading-[18px]">
                  <p className="truncate text-[14px] text-[color:var(--ink)]">{l.fluid}</p>
                  <p className="text-[12px] text-[color:var(--ink-soft)]">{l.volumeMl} ml at {l.rateMlHr} ml/hr · started {clock(l.startedAt)} by {l.startedBy}</p>
                </div>
                <div className="w-[170px] shrink-0">
                  <div className="h-[6px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden"><div className={`h-full ${r.over ? "bg-[#c8001a]" : "bg-[#0a5fc4]"}`} style={{ width: `${r.pct}%` }} /></div>
                  <p className={`mt-1 text-[12px] ${r.over ? "text-[#c8001a] font-medium" : "text-[color:var(--ink-soft)]"}`}>{r.label} · ends {clock(l.endsAt)}</p>
                </div>
                {canWrite && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => stop(l, true)} disabled={loading} className={`${btn.base} ${btn.solid}`}>Finished</button>
                    <button onClick={() => stop(l, false)} disabled={loading} className={`${btn.base} ${btn.ghost}`}>Stop</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && !starting && <p role="alert" className="mt-3 text-[12px] text-[#c8001a]">{error.message}</p>}

      <Modal open={starting} onClose={() => setStarting(false)} title="Start an IV bottle" width={480}
        footer={<>
          <button onClick={() => setStarting(false)} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={start} disabled={loading || !f.patient || f.fluid.trim().length < 2 || !Number(f.volume) || !Number(f.rate)} className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">{loading ? "Starting…" : "Start"}</button>
        </>}>
        <div className="flex flex-col gap-4">
          <FormRow label="Patient" required><FormSelect placeholder="Select patient" value={f.patient} onChange={(v) => setF((x) => ({ ...x, patient: v }))}
            options={patients.map((p) => ({ value: String(p.adm.id), label: `${p.adm.patientName}${p.adm.bed ? ` · ${p.adm.bed}` : ""}` }))} /></FormRow>
          <FormRow label="Fluid" required><FormInput placeholder="e.g. Normal saline 0.9%" value={f.fluid} onChange={(v) => setF((x) => ({ ...x, fluid: v }))} /></FormRow>
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Volume (ml)" required><FormInput type="number" value={f.volume} onChange={(v) => setF((x) => ({ ...x, volume: v }))} /></FormRow>
            <FormRow label="Rate (ml/hr)" required><FormInput type="number" value={f.rate} onChange={(v) => setF((x) => ({ ...x, rate: v }))} /></FormRow>
          </div>
          {error && <p role="alert" className="text-[12px] text-[#c8001a]">{error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
