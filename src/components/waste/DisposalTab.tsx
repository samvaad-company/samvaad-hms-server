"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { WasteDisposalListDTO } from "@/types/api";
import { todayLocal } from "@/components/mrd/shared";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { CATEGORIES, CategoryChip, Err, kg, primaryBtn } from "./shared";

/** Loads handed to the treatment vendor, and how much of each colour is still waiting to go. */
export function DisposalTab({ canWrite }: { canWrite: boolean }) {
  const { item: list } = useItem<WasteDisposalListDTO>("/waste/disposals");
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState<number | null>(null);
  const blank = { date: todayLocal(), category: "", quantityKg: "", vendor: "", manifestNo: "", vehicle: "", notes: "" };
  const [f, setF] = useState(blank);
  const { run, loading, error, reset } = useMutation();
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const close = () => { setOpen(false); setF(blank); reset(); };
  const save = () => run(async () => { await api.post("/waste/disposals", { disposedOn: f.date, category: f.category, quantityKg: Number(f.quantityKg), vendor: f.vendor, manifestNo: f.manifestNo, vehicle: f.vehicle, notes: f.notes }); close(); }).catch(() => undefined);
  if (!list) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const waiting = list.pending.find((p) => p.category === f.category)?.kg;
  return (
    <div className="p-4">
      <div className="mb-3 grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {list.pending.map((p) => (
          <div key={p.category} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
            <CategoryChip category={p.category} label={p.label} />
            <p className="mt-2 font-mono text-[22px] font-bold">{kg(Math.max(0, p.kg))} <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">kg</span></p>
            <p className="text-[12px] text-[color:var(--ink-soft)]">waiting for disposal</p>
          </div>
        ))}
      </div>
      {canWrite && <div className="mb-3 flex"><button className={`${primaryBtn} ml-auto`} onClick={() => setOpen(true)}><Plus size={14} />Log disposal</button></div>}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Category</th><th className="px-4 py-2 text-right font-medium">Qty (kg)</th><th className="px-4 py-2 font-medium">Vendor</th><th className="px-4 py-2 font-medium">Manifest no.</th><th className="px-4 py-2 font-medium">Vehicle</th><th className="w-10" /></tr></thead>
          <tbody>
            {list.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">Nothing has been handed to a vendor yet.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--line)]">
                <td className="px-4 py-[11px] font-mono text-[13px]">{r.date}</td><td className="px-4 py-[11px]"><CategoryChip category={r.category} label={r.categoryLabel} /></td>
                <td className="px-4 py-[11px] text-right font-mono">{kg(r.quantityKg)}</td><td className="px-4 py-[11px]">{r.vendor}</td><td className="px-4 py-[11px] font-mono text-[13px]">{r.manifestNo || "—"}</td><td className="px-4 py-[11px] font-mono text-[13px]">{r.vehicle || "—"}</td>
                <td className="px-2 text-right">{canWrite && <button aria-label={`Delete the disposal of ${r.date}`} className="cursor-pointer p-1 text-[color:var(--ink-soft)] hover:text-[#c8001a]" onClick={() => setGone(r.id)}><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={close} title="Log waste disposal" subtitle="A load handed to the authorised treatment vendor." width={460}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || !f.category || Number(f.quantityKg) <= 0 || f.vendor.trim().length < 2} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">Log disposal</button></div>}>
        <div className="flex flex-col gap-4">
          <FormRow label="Date"><FormInput type="date" value={f.date} onChange={set("date")} max={todayLocal()} /></FormRow>
          <FormRow label="Category" required hint={waiting !== undefined ? `${kg(Math.max(0, waiting))} kg waiting for disposal` : undefined}><FormSelect value={f.category} onChange={set("category")} placeholder="Pick the bin colour" options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} /></FormRow>
          <FormRow label="Quantity (kg)" required><FormInput type="number" value={f.quantityKg} onChange={set("quantityKg")} min="0" /></FormRow>
          <FormRow label="Vendor" required><FormInput value={f.vendor} onChange={set("vendor")} placeholder={list.vendors[0] ?? "Treatment facility"} /></FormRow>
          <div className="grid grid-cols-2 gap-3"><FormRow label="Manifest no."><FormInput value={f.manifestNo} onChange={set("manifestNo")} /></FormRow><FormRow label="Vehicle"><FormInput value={f.vehicle} onChange={set("vehicle")} /></FormRow></div>
          <Err message={error?.message} />
        </div>
      </Modal>
      <ConfirmDialog open={gone !== null} onCancel={() => setGone(null)} confirmLabel="Delete" title="Delete this disposal?" message="The weight goes back to waiting for disposal. The deletion is kept in the audit trail."
        onConfirm={() => { const id = gone; setGone(null); if (id !== null) void run(() => api.del(`/waste/disposals/${id}`)).catch(() => undefined); }} />
    </div>
  );
}
