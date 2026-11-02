"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { CanteenDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BUYERS = ["Staff", "Attendant", "Visitor", "Patient"];

/** The canteen: the menu with prices, and what was sold today to staff, attendants and visitors. */
export function CanteenTab({ date, canWrite }: { date: string; canWrite: boolean }) {
  const { item: c } = useItem<CanteenDTO>(`/dietary/canteen?date=${date}`);
  const [dialog, setDialog] = useState<"item" | "sale" | null>(null);
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const [itemId, setItemId] = useState(""); const [quantity, setQuantity] = useState("1"); const [buyerType, setBuyerType] = useState("Staff"); const [buyer, setBuyer] = useState("");
  const { run, loading, error, reset } = useMutation();
  const close = () => { setDialog(null); setName(""); setPrice(""); setItemId(""); setQuantity("1"); setBuyerType("Staff"); setBuyer(""); reset(); };
  const save = () => run(async () => {
    if (dialog === "item") await api.post("/dietary/canteen/items", { name, price: Number(price) });
    else await api.post("/dietary/canteen/sales", { itemId: Number(itemId), quantity: Number(quantity), buyerType, buyer });
    close();
  }).catch(() => undefined);
  if (!c) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const price1 = c.items.find((i) => String(i.id) === itemId)?.price ?? 0;
  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="font-mono text-[13px] text-[color:var(--ink-soft)]">Today: <b className="text-[color:var(--ink)]">{c.totals.sales}</b> sales · <b className="text-[color:var(--ink)]">{c.totals.quantity}</b> items · <b className="text-[color:var(--ink)]">{inr(c.totals.amount)}</b></p>
        {canWrite && <div className="ml-auto flex gap-2">
          <button onClick={() => setDialog("item")} className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] font-medium"><Plus size={14} />Menu item</button>
          <button onClick={() => setDialog("sale")} disabled={!c.items.some((i) => i.active)} className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] bg-[color:var(--brand)] px-3 py-[6px] text-[13px] font-medium text-white disabled:opacity-50"><Plus size={14} />Record sale</button>
        </div>}
      </div>
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)" }}>
        <section className="overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
          <h2 className="border-b border-[color:var(--line)] px-4 py-2 text-[13px] font-semibold">Menu</h2>
          {c.items.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">No menu items yet.</p>}
          {c.items.map((i) => (
            <div key={i.id} className={`flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-[9px] text-[14px] last:border-b-0 ${i.active ? "" : "opacity-55"}`}>
              <span className="font-medium">{i.name}</span><span className="font-mono text-[13px] text-[color:var(--ink-soft)]">{inr(i.price)}</span>
              <span className="ml-auto font-mono text-[12px] text-[color:var(--ink-soft)]">{i.soldToday} sold</span>
              {canWrite && <button className="cursor-pointer text-[12px] font-medium text-[color:var(--ink-soft)]" onClick={() => void run(() => api.patch(`/dietary/canteen/items/${i.id}`, { active: !i.active })).catch(() => undefined)}>{i.active ? "Off" : "On"}</button>}
            </div>
          ))}
        </section>
        <section className="overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
          <h2 className="border-b border-[color:var(--line)] px-4 py-2 text-[13px] font-semibold">Sales</h2>
          {c.sales.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing sold yet today.</p>}
          {c.sales.map((s) => (
            <div key={s.id} className="flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-[9px] text-[13px] last:border-b-0">
              <span className="font-mono text-[11px] text-[color:var(--ink-soft)]">{new Date(s.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              <span className="font-medium">{s.item} <span className="font-mono font-normal">×{s.quantity}</span></span>
              <span className="text-[color:var(--ink-soft)]">{s.buyerType}{s.buyer && ` · ${s.buyer}`}</span>
              <span className="ml-auto font-mono font-semibold">{inr(s.total)}</span>
            </div>
          ))}
        </section>
      </div>
      <Modal open={!!dialog} onClose={close} width={420} title={dialog === "item" ? "New menu item" : "Record canteen sale"}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || (dialog === "item" ? name.trim().length < 2 || price === "" : !itemId || Number(quantity) < 1)} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{dialog === "item" ? "Add item" : "Record sale"}</button></div>}>
        <div className="flex flex-col gap-4">
          {dialog === "item" ? (<>
            <FormRow label="Name" required><FormInput value={name} onChange={setName} placeholder="e.g. Veg thali" /></FormRow>
            <FormRow label="Price (₹)" required><FormInput type="number" value={price} onChange={setPrice} min="0" /></FormRow>
          </>) : (<>
            <FormRow label="Item" required><FormSelect value={itemId} onChange={setItemId} placeholder="Pick an item" options={c.items.filter((i) => i.active).map((i) => ({ value: String(i.id), label: `${i.name} — ${inr(i.price)}` }))} /></FormRow>
            <FormRow label="Quantity" required hint={itemId ? `Total ${inr(price1 * (Number(quantity) || 0))}` : undefined}><FormInput type="number" value={quantity} onChange={setQuantity} min="1" /></FormRow>
            <FormRow label="Sold to"><FormSelect value={buyerType} onChange={setBuyerType} options={BUYERS.map((b) => ({ value: b, label: b }))} /></FormRow>
            <FormRow label="Name"><FormInput value={buyer} onChange={setBuyer} placeholder="Optional" /></FormRow>
          </>)}
          {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
        </div>
      </Modal>
    </div>
  );
}
