"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import type { DietOrderDTO, DietTypeDTO, IpdRecordDTO } from "@/types/api";
import { DIET_MEALS } from "@/types/api";
import { dmy } from "@/components/mrd/shared";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";

/** Every diet order — live ones first — with a way to raise a new one for an admitted patient. */
export function OrdersTab({ wardId, canWrite }: { wardId: number | null; canWrite: boolean }) {
  const [status, setStatus] = useState<"Active" | "Stopped">("Active");
  const { item: orders } = useItem<DietOrderDTO[]>(`/dietary/orders?status=${status}${wardId ? `&wardId=${wardId}` : ""}`);
  const { item: diets } = useItem<DietTypeDTO[]>("/dietary/diets");
  const { items: admissions } = useList<IpdRecordDTO>("/ipd", { all: true });
  const [open, setOpen] = useState(false);
  const [admissionId, setAdmissionId] = useState("");
  const [dietId, setDietId] = useState("");
  const [meals, setMeals] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const { run, loading, error, reset } = useMutation();
  const close = () => { setOpen(false); setAdmissionId(""); setDietId(""); setMeals([]); setInstructions(""); reset(); };
  const pick = (id: string) => { setDietId(id); const d = diets?.find((x) => String(x.id) === id); if (d) { setMeals(d.meals); setInstructions(d.instructions); } };
  const admitted = admissions.filter((a) => a.status !== "Discharged");
  const save = () => run(async () => { await api.post("/dietary/orders", { admissionId: Number(admissionId), dietTypeId: Number(dietId), meals, instructions }); close(); }).catch(() => undefined);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div role="tablist" className="inline-flex rounded-[8px] bg-[color:var(--subtle-2)] p-[3px]">
          {(["Active", "Stopped"] as const).map((s) => <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`cursor-pointer rounded-[6px] px-3 py-[4px] text-[13px] ${status === s ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{s}</button>)}
        </div>
        {canWrite && <button onClick={() => setOpen(true)} className="ml-auto inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-3 py-[6px] text-[13px] font-medium text-white"><Plus size={14} />New diet order</button>}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Patient</th><th className="px-4 py-2 font-medium">Ward · Bed</th><th className="px-4 py-2 font-medium">Diet</th><th className="px-4 py-2 font-medium">Meals</th><th className="px-4 py-2 font-medium">{status === "Active" ? "Since" : "Stopped"}</th><th className="px-4 py-2" /></tr></thead>
          <tbody>
            {orders?.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No {status.toLowerCase()} diet orders.</td></tr>}
            {orders?.map((o) => (
              <tr key={o.id} className="border-t border-[color:var(--line)] align-top">
                <td className="px-4 py-[9px] font-medium">{o.patient}<span className="ml-1 font-mono text-[11px] font-normal text-[color:var(--ink-soft)]">{o.patientCode}</span></td>
                <td className="px-4 py-[9px]">{o.ward} · <span className="font-mono text-[13px]">{o.bed}</span></td>
                <td className="px-4 py-[9px]">{o.diet}{o.instructions && <p className="max-w-[320px] text-[12px] text-[color:var(--ink-soft)]">{o.instructions}</p>}</td>
                <td className="px-4 py-[9px] text-[13px]">{o.meals.length ? o.meals.join(", ") : "None (nil by mouth)"}</td>
                <td className="px-4 py-[9px] text-[13px]">{dmy(status === "Active" ? o.startDate : o.stoppedOn)}</td>
                <td className="px-4 py-[9px] text-right">{canWrite && o.status === "Active" && <button className="cursor-pointer text-[13px] font-medium text-[#c8001a]" onClick={() => void run(() => api.post(`/dietary/orders/${o.id}/stop`)).catch(() => undefined)}>Stop</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && !open && <p role="alert" className="mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}

      <Modal open={open} onClose={close} title="New diet order" subtitle="Replaces the patient's current diet order, if they have one." width={480}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || !admissionId || !dietId} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">Save order</button></div>}>
        <div className="flex flex-col gap-4">
          <FormRow label="Patient" required><FormSelect value={admissionId} onChange={setAdmissionId} placeholder="Pick an admitted patient" options={admitted.map((a) => ({ value: String(a.id), label: `${a.patientName} · ${a.ward} ${a.bed}` }))} /></FormRow>
          <FormRow label="Diet" required><FormSelect value={dietId} onChange={pick} placeholder="Pick a diet" options={(diets ?? []).filter((d) => d.active).map((d) => ({ value: String(d.id), label: d.name }))} /></FormRow>
          <FormRow label="Meals"><div className="flex flex-wrap gap-x-4 gap-y-2">{DIET_MEALS.map((m) => <label key={m} className="inline-flex cursor-pointer items-center gap-2 text-[14px]"><input type="checkbox" checked={meals.includes(m)} onChange={(e) => setMeals(e.target.checked ? [...meals, m] : meals.filter((x) => x !== m))} />{m}</label>)}</div></FormRow>
          <FormRow label="Instructions for the kitchen"><FormInput value={instructions} onChange={setInstructions} placeholder="Optional" /></FormRow>
          {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
