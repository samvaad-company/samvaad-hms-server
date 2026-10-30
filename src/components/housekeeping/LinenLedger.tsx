"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { HkLinenDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";

const when = (ts: string) => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", ",");
const ACTIONS = ["new_stock", "collect_soiled", "send_laundry", "receive_clean", "issue_ward", "discard"];
const num = "px-4 py-[10px] text-right font-mono";

/** The linen ledger: where every piece is now, and each movement that got it there. */
export function LinenLedger() {
  const { item } = useItem<HkLinenDTO>("/housekeeping/linen");
  const [kind, setKind] = useState<string | null>(null);
  const [category, setCategory] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [wardId, setWardId] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("piece");
  const [reorder, setReorder] = useState("");
  const { run, loading, error, reset } = useMutation();
  const close = () => { setKind(null); setCategory(false); setCategoryId(""); setQuantity(""); setWardId(""); setNotes(""); setName(""); setUnit("piece"); setReorder(""); reset(); };
  if (!item) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const k = item.kinds.find((x) => x.kind === kind);
  const record = () => run(async () => {
    if (category) await api.post("/housekeeping/linen/categories", { name, unit, reorderAt: Number(reorder) || 0 });
    else await api.post("/housekeeping/linen/moves", { kind, categoryId: Number(categoryId), quantity: Number(quantity), ...(wardId && { wardId: Number(wardId) }), notes });
    close();
  }).catch(() => undefined);
  const ready = category ? name.trim().length >= 2 : !!categoryId && Number(quantity) > 0 && (!k?.needsWard || !!wardId);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ACTIONS.map((a) => { const x = item.kinds.find((y) => y.kind === a)!; return <button key={a} title={x.hint} onClick={() => setKind(a)} className="cursor-pointer rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] font-medium hover:bg-[color:var(--subtle)]">{x.label}</button>; })}
        <button onClick={() => setCategory(true)} className="ml-auto inline-flex cursor-pointer items-center gap-1 px-2 py-[6px] text-[13px] font-medium"><Plus size={14} />Category</button>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Category</th><th className={`${num} font-medium`}>Store</th><th className={`${num} font-medium`}>Wards</th><th className={`${num} font-medium`}>Soiled</th><th className={`${num} font-medium`}>Laundry</th><th className={`${num} font-medium`}>Total</th><th className={`${num} font-medium`}>Reorder at</th></tr></thead>
          <tbody>
            {item.categories.map((c) => (
              <tr key={c.id} className="border-t border-[color:var(--line)]">
                <td className="px-4 py-[10px] font-medium">{c.name} <span className="text-[12px] font-normal text-[color:var(--ink-soft)]">{c.unit}</span></td>
                <td className={`${num} font-semibold ${c.low ? "text-[#d10024]" : ""}`} title={c.low ? "Below the reorder level" : undefined}>{c.store}</td>
                <td className={num}>{c.wards}</td><td className={num}>{c.soiled}</td><td className={num}>{c.laundry}</td><td className={`${num} font-semibold`}>{c.total}</td><td className={`${num} text-[color:var(--ink-soft)]`}>{c.reorderAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">Recent movements</h2>
      {item.moves.length === 0 && <p className="rounded-[10px] border border-[color:var(--line)] py-8 text-center text-[13px] text-[color:var(--ink-soft)]">No movements yet — record new stock to begin.</p>}
      <ul className="flex flex-col gap-2">
        {item.moves.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[7px] text-[13px]">
            <span className="shrink-0 rounded-[6px] border border-[color:var(--line)] px-2 py-[1px] text-[12px]">{m.label}</span>
            <span className="font-semibold">{m.category} <span className="font-mono font-normal">×{m.quantity}</span></span>
            <span className="text-[color:var(--ink-soft)]">{m.from} → {m.to}</span>
            <span className="font-mono text-[11px] text-[color:var(--ink-soft)]">{m.fromBalance != null && `from→${m.fromBalance} `}{m.toBalance != null && `to→${m.toBalance}`}</span>
            <span className="ml-auto font-mono text-[12px] text-[color:var(--ink-soft)]">{when(m.at)}</span>
          </li>
        ))}
      </ul>

      <Modal open={!!kind || category} onClose={close} width={440} title={category ? "New linen category" : k?.label ?? ""}
        subtitle={category ? "Something the hospital counts and washes, like a sheet or a gown." : `${k?.hint}. Appends to the ledger — a movement that would take more than there is, is refused.`}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void record()} disabled={loading || !ready} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{category ? "Add category" : "Record"}</button></div>}>
        <div className="flex flex-col gap-4">
          {category ? (<>
            <FormRow label="Name" required><FormInput value={name} onChange={setName} placeholder="e.g. Curtain" /></FormRow>
            <FormRow label="Unit"><FormInput value={unit} onChange={setUnit} /></FormRow>
            <FormRow label="Reorder at" hint="Warn when the linen store holds fewer than this."><FormInput type="number" value={reorder} onChange={setReorder} min="0" /></FormRow>
          </>) : (<>
            <FormRow label="Category" required><FormSelect value={categoryId} onChange={setCategoryId} placeholder="Pick a category" options={item.categories.map((c) => ({ value: String(c.id), label: c.name }))} /></FormRow>
            <FormRow label="Quantity" required><FormInput type="number" value={quantity} onChange={setQuantity} min="1" /></FormRow>
            {k?.needsWard && <FormRow label="Ward" required><FormSelect value={wardId} onChange={setWardId} placeholder="Pick the ward" options={item.wards.map((w) => ({ value: String(w.id), label: w.name }))} /></FormRow>}
            <FormRow label="Notes"><FormInput value={notes} onChange={setNotes} placeholder="Optional" /></FormRow>
          </>)}
          {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
