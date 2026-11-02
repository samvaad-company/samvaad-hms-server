"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { HkBoardDTO, WasteCollectionListDTO } from "@/types/api";
import { dmy, todayLocal } from "@/components/mrd/shared";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { CATEGORIES, CategoryChip, Err, kg, primaryBtn } from "./shared";

/** The bin collections, newest first: which ward, which colour, how much. */
export function CollectionTab({ canWrite }: { canWrite: boolean }) {
  const { item: list } = useItem<WasteCollectionListDTO>("/waste/collections");
  const { item: board } = useItem<HkBoardDTO>("/housekeeping");
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState<number | null>(null);
  const blank = { date: todayLocal(), time: "", wardId: "", category: "", quantityKg: "", bags: "1", notes: "" };
  const [f, setF] = useState(blank);
  const { run, loading, error, reset } = useMutation();
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const close = () => { setOpen(false); setF(blank); reset(); };
  const save = () => run(async () => {
    await api.post("/waste/collections", { collectedOn: f.date, ...(f.time && { collectedTime: f.time }), wardId: Number(f.wardId), category: f.category, quantityKg: Number(f.quantityKg), bags: Number(f.bags), notes: f.notes });
    close();
  }).catch(() => undefined);
  if (!list) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-mono text-[13px] text-[color:var(--ink-soft)]"><b className="text-[color:var(--ink)]">{list.total}</b> entries · <b className="text-[color:var(--ink)]">{kg(list.kg)}</b> kg · <b className="text-[color:var(--ink)]">{list.bags}</b> bags</p>
        {canWrite && <button className={`${primaryBtn} ml-auto`} onClick={() => setOpen(true)}><Plus size={14} />Log collection</button>}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Ward</th><th className="px-4 py-2 font-medium">Category</th><th className="px-4 py-2 text-right font-medium">Qty (kg)</th><th className="px-4 py-2 text-right font-medium">Bags</th><th className="px-4 py-2 font-medium">Time</th><th className="w-10" /></tr></thead>
          <tbody>
            {list.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No waste has been logged yet.</td></tr>}
            {list.rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--line)]">
                <td className="px-4 py-[11px] font-mono text-[13px]">{r.date}</td><td className="px-4 py-[11px]">{r.ward}</td>
                <td className="px-4 py-[11px]"><CategoryChip category={r.category} label={r.categoryLabel} /></td>
                <td className="px-4 py-[11px] text-right font-mono">{kg(r.quantityKg)}</td><td className="px-4 py-[11px] text-right font-mono">{r.bags}</td><td className="px-4 py-[11px] font-mono text-[13px]">{r.time}</td>
                <td className="px-2 text-right">{canWrite && <button aria-label={`Delete the ${r.categoryLabel} entry of ${dmy(r.date)}`} className="cursor-pointer p-1 text-[color:var(--ink-soft)] hover:text-[#c8001a]" onClick={() => setGone(r.id)}><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={close} title="Log waste collection" subtitle="Weigh the bag at the ward and record it against its colour." width={460}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || !f.wardId || !f.category || Number(f.quantityKg) <= 0} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">Log collection</button></div>}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3"><FormRow label="Date"><FormInput type="date" value={f.date} onChange={set("date")} max={todayLocal()} /></FormRow><FormRow label="Time" hint="Blank = now"><FormInput type="time" value={f.time} onChange={set("time")} /></FormRow></div>
          <FormRow label="Ward" required><FormSelect value={f.wardId} onChange={set("wardId")} placeholder="Pick the ward" options={(board?.wards ?? []).map((w) => ({ value: String(w.id), label: w.name }))} /></FormRow>
          <FormRow label="Category" required><FormSelect value={f.category} onChange={set("category")} placeholder="Pick the bin colour" options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} /></FormRow>
          <div className="grid grid-cols-2 gap-3"><FormRow label="Quantity (kg)" required><FormInput type="number" value={f.quantityKg} onChange={set("quantityKg")} min="0" /></FormRow><FormRow label="Bags"><FormInput type="number" value={f.bags} onChange={set("bags")} min="0" /></FormRow></div>
          <FormRow label="Notes"><FormInput value={f.notes} onChange={set("notes")} placeholder="Optional" /></FormRow>
          <Err message={error?.message} />
        </div>
      </Modal>
      <ConfirmDialog open={gone !== null} onCancel={() => setGone(null)} confirmLabel="Delete" title="Delete this entry?" message="It is removed from the register; the deletion is kept in the audit trail."
        onConfirm={() => { const id = gone; setGone(null); if (id !== null) void run(() => api.del(`/waste/collections/${id}`)).catch(() => undefined); }} />
    </div>
  );
}
