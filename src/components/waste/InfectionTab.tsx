"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { HkBoardDTO, InfectionControlDTO } from "@/types/api";
import { dmy, todayLocal } from "@/components/mrd/shared";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { Err, ghostBtn, primaryBtn } from "./shared";

/** Infections noticed on the wards (open until resolved) and the hand-hygiene audits. */
export function InfectionTab({ canWrite }: { canWrite: boolean }) {
  const { item: ic } = useItem<InfectionControlDTO>("/waste/infection");
  const { item: board } = useItem<HkBoardDTO>("/housekeeping");
  const [dialog, setDialog] = useState<"event" | "audit" | null>(null);
  const blank = { date: todayLocal(), wardId: "", type: "", patient: "", code: "", organism: "", device: "", notes: "", observed: "", compliant: "" };
  const [f, setF] = useState(blank);
  const { run, loading, error, reset } = useMutation();
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const close = () => { setDialog(null); setF(blank); reset(); };
  const save = () => run(async () => {
    if (dialog === "event") await api.post("/waste/infection/events", { eventDate: f.date, ...(f.wardId && { wardId: Number(f.wardId) }), infectionType: f.type, patientName: f.patient, patientCode: f.code, organism: f.organism, deviceProcedure: f.device, notes: f.notes });
    else await api.post("/waste/infection/hand-hygiene", { auditDate: f.date, wardId: Number(f.wardId), observed: Number(f.observed), compliant: Number(f.compliant), notes: f.notes });
    close();
  }).catch(() => undefined);
  if (!ic) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const wardOptions = (board?.wards ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  return (
    <div className="p-4">
      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[14px] font-semibold">Infection events <span className="ml-2 font-mono text-[13px] font-normal text-[#c8001a]">{ic.open} open</span></h2>
          {canWrite && <button className={`${primaryBtn} ml-auto`} onClick={() => setDialog("event")}><Plus size={14} />Log infection</button>}
        </div>
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
          <table className="w-full border-collapse text-[14px]">
            <thead><tr className="text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Ward</th><th className="px-4 py-2 font-medium">Patient</th><th className="px-4 py-2 font-medium">Organism · device</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
            <tbody>
              {ic.events.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--ink-soft)]">No infections have been logged.</td></tr>}
              {ic.events.map((e) => (
                <tr key={e.id} className="border-t border-[color:var(--line)]">
                  <td className="px-4 py-[10px] font-mono text-[13px]">{e.date}</td><td className="px-4 py-[10px] font-medium">{e.type}</td><td className="px-4 py-[10px]">{e.ward || "—"}</td>
                  <td className="px-4 py-[10px]">{e.patient || "—"}{e.patientCode && <span className="ml-1 font-mono text-[11px] text-[color:var(--ink-soft)]">{e.patientCode}</span>}</td>
                  <td className="px-4 py-[10px] text-[13px]">{[e.organism, e.deviceProcedure].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-[10px]">{e.status === "Open"
                    ? <span className="inline-flex items-center gap-2"><span className="rounded-full border border-[#f3b4b4] bg-[#ffe9e9] px-[10px] py-[1px] text-[12px] text-[#a3001a]">Open</span>{canWrite && <button className="cursor-pointer text-[13px] font-medium text-[color:var(--brand)]" onClick={() => void run(() => api.post(`/waste/infection/events/${e.id}/resolve`)).catch(() => undefined)}>Resolve</button>}</span>
                    : <span className="text-[13px] text-[color:var(--ink-soft)]">Resolved {dmy(e.resolvedOn)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-7">
        <div className="mb-2 flex items-center gap-3"><h2 className="text-[14px] font-semibold">Hand hygiene audits</h2>{canWrite && <button className={`${ghostBtn} ml-auto`} onClick={() => setDialog("audit")}><Plus size={14} />Log audit</button>}</div>
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
          <table className="w-full border-collapse text-[14px]">
            <thead><tr className="text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Ward</th><th className="px-4 py-2 text-right font-medium">Observed</th><th className="px-4 py-2 text-right font-medium">Compliant</th><th className="px-4 py-2 text-right font-medium">Compliance</th><th className="px-4 py-2 font-medium">Auditor</th></tr></thead>
            <tbody>
              {ic.audits.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--ink-soft)]">No audits yet.</td></tr>}
              {ic.audits.map((a) => (
                <tr key={a.id} className="border-t border-[color:var(--line)]"><td className="px-4 py-[10px] font-mono text-[13px]">{a.date}</td><td className="px-4 py-[10px]">{a.ward}</td><td className="px-4 py-[10px] text-right font-mono">{a.observed}</td><td className="px-4 py-[10px] text-right font-mono">{a.compliant}</td>
                  <td className={`px-4 py-[10px] text-right font-mono font-semibold ${a.pct < 80 ? "text-[#d10024]" : "text-[#0b7a47]"}`}>{a.pct}%</td><td className="px-4 py-[10px] text-[13px]">{a.auditor}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Modal open={!!dialog} onClose={close} width={460} title={dialog === "event" ? "Log infection" : "Log hand hygiene audit"}
        subtitle={dialog === "event" ? "A healthcare-associated infection or an outbreak signal." : "Moments observed against moments where hands were cleaned correctly."}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || (dialog === "event" ? !f.type : !f.wardId || Number(f.observed) < 1 || f.compliant === "")} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">Save</button></div>}>
        <div className="flex flex-col gap-4">
          <FormRow label="Date"><FormInput type="date" value={f.date} onChange={set("date")} max={todayLocal()} /></FormRow>
          <FormRow label="Ward" required={dialog === "audit"}><FormSelect value={f.wardId} onChange={set("wardId")} placeholder="Pick the ward" options={wardOptions} /></FormRow>
          {dialog === "event" ? (<>
            <FormRow label="Infection type" required><FormSelect value={f.type} onChange={set("type")} placeholder="Pick a type" options={ic.types.map((t) => ({ value: t, label: t }))} /></FormRow>
            <div className="grid grid-cols-2 gap-3"><FormRow label="Patient"><FormInput value={f.patient} onChange={set("patient")} /></FormRow><FormRow label="Patient ID"><FormInput value={f.code} onChange={set("code")} /></FormRow></div>
            <div className="grid grid-cols-2 gap-3"><FormRow label="Organism"><FormInput value={f.organism} onChange={set("organism")} placeholder="e.g. MRSA" /></FormRow><FormRow label="Device / procedure"><FormInput value={f.device} onChange={set("device")} placeholder="e.g. Urinary catheter" /></FormRow></div>
          </>) : (
            <div className="grid grid-cols-2 gap-3"><FormRow label="Moments observed" required><FormInput type="number" value={f.observed} onChange={set("observed")} min="1" /></FormRow><FormRow label="Done correctly" required><FormInput type="number" value={f.compliant} onChange={set("compliant")} min="0" /></FormRow></div>
          )}
          <FormRow label="Notes"><FormInput value={f.notes} onChange={set("notes")} placeholder="Optional" /></FormRow>
          <Err message={error?.message} />
        </div>
      </Modal>
    </div>
  );
}
