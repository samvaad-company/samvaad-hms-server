"use client";

/**
 * Bedside pharmacy: a nurse or doctor takes medicines from the pharmacy to this patient's bed. Each trip is one delivery: stock comes out
 * of the pharmacy, the pharmacy raises its own bill, and that bill stays Pending. No payment is taken at the bed; everything pending is
 * collected with the final bill when the patient is discharged.
 */
import { useEffect, useState } from "react";
import { Minus, Pill as PillIcon, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { DispenseDTO, DispenseStockDTO } from "@/types/api";
import type { SetupRecordDTO } from "@/types/setup";
import { Card, ChartCtx, ErrorLine, Notice, Pill, btn, dateTime, done, inr, inputCls } from "@/components/ipd/patient/ui";

interface Line { itemId: number; name: string; available: number; price: number; quantity: number }

export function BedsideTab({ ctx }: { ctx: ChartCtx }) {
  const { items: deliveries, reload } = useList<DispenseDTO>(`/ipd/${ctx.id}/bedside`);
  const { run, loading, error, reset } = useMutation();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<DispenseStockDTO[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [sent, setSent] = useState<DispenseDTO | null>(null);
  // Default: nothing is collected at the bed, the bill stays Pending for discharge. The nurse can choose to take payment now.
  const [payNow, setPayNow] = useState(false);
  const [mode, setMode] = useState("");
  const { items: modes } = useList<SetupRecordDTO>("/setup/payment_mode", { active: 1 });
  useEffect(() => { if (!mode && modes.length) setMode((modes.find((m) => /cash/i.test(m.name)) ?? modes[0]).name); }, [modes, mode]);
  const can = ctx.canWrite && !ctx.discharged;

  useEffect(() => {
    if (!can) return;
    let dead = false;
    const t = setTimeout(() => {
      api.get<DispenseStockDTO[]>(`/ipd/${ctx.id}/bedside/stock`, { q: q.trim() }).then((r) => { if (!dead) setFound(r.filter((s) => s.itemId > 0)); }).catch(() => { if (!dead) setFound([]); });
    }, 200);
    return () => { dead = true; clearTimeout(t); };
  }, [q, can, ctx.id]);

  const add = (s: DispenseStockDTO) => setLines((cur) => cur.some((l) => l.itemId === s.itemId) ? cur.map((l) => l.itemId === s.itemId ? { ...l, quantity: Math.min(l.available, l.quantity + 1) } : l) : [...cur, { itemId: s.itemId, name: s.name, available: s.available, price: s.unitPrice, quantity: 1 }]);
  const setQty = (id: number, n: number) => setLines((cur) => cur.map((l) => l.itemId === id ? { ...l, quantity: Math.max(1, Math.min(l.available, Math.floor(n) || 1)) } : l));
  const total = lines.reduce((n, l) => n + l.quantity * l.price, 0);

  async function deliver() {
    reset(); setSent(null);
    const made = await done(run(() => api.post<DispenseDTO>(`/ipd/${ctx.id}/bedside`, { lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })), ...(payNow ? { payNow: true, paymentMode: mode } : {}) })));
    if (!made) return;
    setLines([]); setQ("");
    reload(); ctx.refresh();
    const r = await api.get<DispenseDTO[]>(`/ipd/${ctx.id}/bedside`).catch(() => [] as DispenseDTO[]);
    setSent(r[0] ?? null);
  }

  const pending = deliveries.filter((d) => d.billStatus === "Pending" || d.billStatus === "Partial").reduce((n, d) => n + (d.billTotal ?? 0), 0);
  const where = `${ctx.record.ward ? `${ctx.record.ward} · ` : ""}${ctx.record.bed || "no bed"}`;

  return (
    <div className="flex flex-col gap-4 p-5">
      <Notice tone="info">
        Medicines taken to the bed come out of the pharmacy&apos;s stock and the pharmacy raises a bill for each trip. <b>By default no payment is taken at the bed</b>: the bill
        stays Pending and is added to what {ctx.record.patientName} owes, to be paid with the final bill at discharge. You can choose to take payment now instead.
      </Notice>

      {can ? (
        <Card title={`Take medicines to ${where}`} hint="Search the pharmacy's stock, add what you are taking, then confirm.">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the pharmacy stock by name…" className={`${inputCls} !pl-[34px]`} />
            </div>
            {found.length > 0 && (
              <div className="grid max-h-[220px] gap-2 overflow-auto sm:grid-cols-2">
                {found.map((s) => (
                  <button key={s.itemId} type="button" onClick={() => add(s)} className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[color:var(--line)] px-3 py-2 text-left text-[13px] hover:bg-[color:var(--subtle)]">
                    <PillIcon size={14} className="shrink-0 text-[color:var(--brand)]" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[color:var(--ink)]">{s.name}</span><span className="text-[11px] text-[color:var(--ink-soft)]">{s.available} in stock{s.nextExpiry ? ` · exp ${s.nextExpiry}` : ""}</span></span>
                    <span className="shrink-0 text-[12px] text-[color:var(--ink)]">{inr(s.unitPrice)}</span>
                    <Plus size={14} className="shrink-0 text-[color:var(--brand)]" />
                  </button>
                ))}
              </div>
            )}
            {q.trim().length > 1 && found.length === 0 && <p className="text-[12px] text-[color:var(--ink-soft)]">Nothing in the pharmacy&apos;s stock matches. Ask the pharmacy to add it.</p>}

            {lines.length > 0 && (
              <div className="rounded-[8px] border border-[color:var(--line)]">
                {lines.map((l) => (
                  <div key={l.itemId} className="flex items-center gap-3 border-b border-[color:var(--subtle-2)] px-3 py-2 text-[13px] last:border-0">
                    <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--ink)]">{l.name}</span>
                    <span className="text-[12px] text-[color:var(--ink-soft)]">{inr(l.price)} each</span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label="Fewer" onClick={() => setQty(l.itemId, l.quantity - 1)} className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[6px] border border-[color:var(--line)] hover:bg-[color:var(--subtle)]"><Minus size={12} /></button>
                      <input aria-label="Quantity" inputMode="numeric" value={l.quantity} onChange={(e) => setQty(l.itemId, Number(e.target.value.replace(/[^0-9]/g, "")))} className="h-[28px] w-[48px] rounded-[6px] border border-[color:var(--line)] bg-[color:var(--subtle)] text-center text-[13px]" />
                      <button type="button" aria-label="More" onClick={() => setQty(l.itemId, l.quantity + 1)} className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[6px] border border-[color:var(--line)] hover:bg-[color:var(--subtle)]"><Plus size={12} /></button>
                    </span>
                    <span className="w-[70px] text-right font-medium">{inr(l.quantity * l.price)}</span>
                    <button type="button" aria-label="Remove" onClick={() => setLines((cur) => cur.filter((x) => x.itemId !== l.itemId))} className="cursor-pointer text-[color:var(--ink-soft)] hover:text-[#b3001b]"><Trash2 size={14} /></button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[color:var(--subtle-2)] px-3 py-2 text-[13px]" role="radiogroup" aria-label="Payment">
                  <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="bedpay" checked={!payNow} onChange={() => setPayNow(false)} className="accent-[color:var(--brand)]" /> Do not take payment — keep it Pending, to pay at discharge</label>
                  <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="bedpay" checked={payNow} onChange={() => setPayNow(true)} className="accent-[color:var(--brand)]" /> Patient pays now</label>
                  {payNow && (
                    <select aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)} className="h-[30px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[12px]">
                      {modes.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[13px] text-[color:var(--ink)]">Bill for this trip: <b>{inr(total)}</b> {payNow ? <Pill tone="ok" className="ml-2">Paid at the bed ({mode})</Pill> : <Pill tone="warn" className="ml-2">Payment pending</Pill>}</span>
                  <button type="button" className={`${btn.base} ${btn.solid}`} disabled={loading || (payNow && !mode)} onClick={deliver}>{loading ? "Delivering…" : "Deliver to bed & bill pharmacy"}</button>
                </div>
              </div>
            )}
            <ErrorLine error={error} />
            {sent && <Notice tone="ok">Delivered to {where}. Pharmacy bill {sent.billNumber ?? ""} for {inr(sent.billTotal ?? sent.subtotal)} is {sent.billStatus === "Paid" ? "Paid" : "Pending — nothing was collected"}.{sent.billingWarning ? ` ${sent.billingWarning}` : ""}</Notice>}
          </div>
        </Card>
      ) : <Notice tone="warn">{ctx.discharged ? "This patient has been discharged." : "You can view what was taken to the bed but not add to it."}</Notice>}

      <Card title="Taken to the bed so far" hint={deliveries.length ? `${deliveries.length} ${deliveries.length === 1 ? "delivery" : "deliveries"} · ${pending > 0 ? `${inr(pending)} pending, to be paid at discharge` : "all paid"}` : "Nothing yet"}>
        {deliveries.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing has been taken to this bed from the pharmacy.</p> : deliveries.map((d) => (
          <div key={d.id} className="border-t border-[color:var(--subtle-2)] py-3 text-[13px] first:border-t-0">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[color:var(--ink)]">{d.dispenseNo}</b>
              <span className="text-[12px] text-[color:var(--ink-soft)]">{dateTime(d.at)} · {d.dispensedBy}{d.deliveredByRole ? ` (${d.deliveredByRole})` : ""}</span>
              <span className="ml-auto flex items-center gap-2">
                {d.billNumber && <span className="text-[12px] text-[color:var(--ink-soft)]">{d.billNumber}</span>}
                <span className="font-medium">{inr(d.billTotal ?? d.subtotal)}</span>
                <Pill tone={d.billStatus === "Paid" ? "ok" : d.billStatus === "Refunded" ? "neutral" : "warn"}>{d.billStatus === "Paid" ? "Paid" : d.billStatus === "Refunded" ? "Refunded" : "Payment pending"}</Pill>
              </span>
            </div>
            <ul className="mt-1 list-disc pl-5 text-[12px] text-[color:var(--ink)]">{d.lines.map((l) => <li key={l.id}>{l.medicineName} × {l.quantity} <span className="text-[color:var(--ink-soft)]">({inr(l.lineTotal)})</span></li>)}</ul>
          </div>
        ))}
      </Card>
    </div>
  );
}
