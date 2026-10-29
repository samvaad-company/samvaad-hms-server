"use client";

/** Recent dispensing: each sale with its billing status, a printable slip, and a Return button that opens the sale-return dialog. */
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Printer, Undo2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { printElement } from "@/lib/print";
import type { DispenseDTO, ReturnCondition } from "@/types/api";
import { inr } from "@/types/setup";
import { Modal } from "@/components/shared/Modal";
import { DialogButtons, ErrorNote, Pill } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
/** "26 Sept, 5:11 pm" */
export function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours() % 12 || 12;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
}

export function RecentDispensing({ items, canWrite, onChanged }: { items: DispenseDTO[]; canWrite: boolean; onChanged: () => void }) {
  const [returning, setReturning] = useState<DispenseDTO | null>(null);
  const [printing, setPrinting] = useState<DispenseDTO | null>(null);
  const slip = useRef<HTMLDivElement>(null);
  function print(d: DispenseDTO) {
    flushSync(() => setPrinting(d));
    printElement(slip.current?.firstElementChild as HTMLElement | null, `Dispense ${d.dispenseNo}`);
  }
  return (
    <section aria-label="Recent dispensing" className="border-t border-[color:var(--line)] px-5 pb-3 pt-3">
      <h2 className="mb-1 text-[12px] text-[color:var(--ink-soft)]">Recent dispensing</h2>
      {items.length === 0 ? <p className="py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing has been dispensed yet.</p> : (
        <ul className="divide-y divide-[color:var(--line)]">
          {items.map((d) => {
            const returnable = d.lines.some((l) => l.returnable > 0);
            return (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]"><span className="font-semibold">{d.patientName}</span> <span className="text-[color:var(--ink-soft)]">· {d.summary}</span>{d.walkInNote && <span className="text-[color:var(--ink-soft)]"> · {d.walkInNote}</span>}</p>
                  <p className="text-[12px] text-[color:var(--ink-soft)]">{when(d.at)} · {d.billLabel}{d.status !== "Dispensed" && <span className="ml-2"><Pill tone={d.status === "Returned" ? "grey" : "amber"}>{d.status}</Pill></span>}</p>
                </div>
                <span className="font-mono text-[14px] font-semibold">{inr(d.subtotal)}</span>
                <button onClick={() => print(d)} aria-label={`Print ${d.dispenseNo}`} className="rounded-[6px] p-[6px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><Printer size={15} /></button>
                {canWrite && <button onClick={() => setReturning(d)} disabled={!returnable} className="inline-flex h-[28px] items-center gap-1 rounded-[6px] px-2 text-[13px] hover:bg-[color:var(--subtle)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"><Undo2 size={13} /> Return</button>}
              </li>
            );
          })}
        </ul>
      )}
      {returning && <SaleReturnDialog dispense={returning} onClose={() => { setReturning(null); onChanged(); }} />}
      <div ref={slip} aria-hidden style={{ position: "absolute", left: -99999, top: 0 }}>{printing && <DispenseSlip d={printing} />}</div>
    </section>
  );
}

function SaleReturnDialog({ dispense, onClose }: { dispense: DispenseDTO; onClose: () => void }) {
  const lines = dispense.lines.filter((l) => l.returnable > 0);
  const [picked, setPicked] = useState<Record<number, { quantity: string; condition: ReturnCondition }>>({});
  const { run, loading, error, reset } = useMutation();
  const chosen = Object.entries(picked);
  const valid = chosen.length > 0 && chosen.every(([id, p]) => { const l = lines.find((x) => x.id === Number(id))!; const q = Number(p.quantity); return Number.isInteger(q) && q >= 1 && q <= l.returnable; });
  const toggle = (id: number, returnable: number) => setPicked((p) => { const n = { ...p }; if (id in n) delete n[id]; else n[id] = { quantity: String(returnable), condition: "Usable" }; return n; });
  async function save() {
    reset();
    if (await attempt(run(() => api.post(`/pharmacy/dispense/${dispense.id}/return`, { lines: chosen.map(([id, p]) => ({ lineId: Number(id), quantity: Number(p.quantity), condition: p.condition })) })))) onClose();
  }
  return (
    <Modal open onClose={onClose} width={520} title="Sale return" subtitle="Pick the dispensed batch lines coming back. Usable stock re-enters the exact batch; damaged/expired is written off. Billed lines mint a credit note."
      footer={<DialogButtons onCancel={onClose} onConfirm={save} label="Record return" busyLabel="Recording…" loading={loading} disabled={!valid} />}>
      <div className="flex flex-col gap-2">
        {lines.map((l) => {
          const p = picked[l.id];
          return (
            <div key={l.id} className="rounded-[8px] border border-[color:var(--line)] px-3 py-2">
              <label className="flex cursor-pointer items-center gap-3 text-[14px]">
                <input type="checkbox" checked={!!p} onChange={() => toggle(l.id, l.returnable)} />
                <span className="min-w-0 flex-1 truncate font-medium">{l.medicineName} <span className="ml-1 font-mono text-[11px] font-normal text-[color:var(--ink-soft)]">{l.batchNo}</span></span>
                <span className="text-[12px] text-[color:var(--ink-soft)]">returnable {l.returnable}</span>
              </label>
              {p && (
                <div className="mt-2 flex items-center gap-2 pl-7">
                  <input aria-label={`Quantity of ${l.medicineName} returned`} type="number" min={1} max={l.returnable} value={p.quantity} onChange={(e) => setPicked((s) => ({ ...s, [l.id]: { ...p, quantity: e.target.value } }))} className="h-[32px] w-[80px] rounded-[6px] border border-[color:var(--line)] px-2 text-right font-mono text-[13px]" />
                  <select aria-label="Condition" value={p.condition} onChange={(e) => setPicked((s) => ({ ...s, [l.id]: { ...p, condition: e.target.value as ReturnCondition } }))} className="h-[32px] rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px]">
                    {(["Usable", "Damaged", "Expired"] as const).map((c) => <option key={c} value={c}>{c === "Usable" ? "Usable — back to stock" : c === "Damaged" ? "Damaged — write off" : "Expired — write off"}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
        {lines.length === 0 && <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">Everything on this sale has been returned.</p>}
        <p className="text-[12px] text-[color:var(--ink-soft)]">Refund note: billed returns settle through the credit note in billing; cash-at-counter refunds are not part of this flow.</p>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

function DispenseSlip({ d }: { d: DispenseDTO }) {
  const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #111", padding: "4px 6px", fontSize: 12 };
  const td: React.CSSProperties = { padding: "4px 6px", fontSize: 12, borderBottom: "1px solid #ddd" };
  return (
    <div style={{ width: 560, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Pharmacy dispense slip</h1>
      <p style={{ fontSize: 12, margin: "4px 0 12px" }}>{d.dispenseNo} · {when(d.at)}</p>
      <p style={{ fontSize: 13, margin: "2px 0" }}><b>Patient:</b> {d.patientName}{d.walkInNote ? ` (${d.walkInNote})` : ""}</p>
      {d.rxNumber && <p style={{ fontSize: 13, margin: "2px 0" }}><b>Prescription:</b> {d.rxNumber}</p>}
      <p style={{ fontSize: 13, margin: "2px 0 10px" }}><b>Billing:</b> {d.billLabel}</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Medicine</th><th style={th}>Batch</th><th style={th}>Expiry</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Price</th><th style={{ ...th, textAlign: "right" }}>Amount</th></tr></thead>
        <tbody>{d.lines.map((l) => <tr key={l.id}><td style={td}>{l.medicineName}</td><td style={td}>{l.batchNo}</td><td style={td}>{l.expiryDate || "—"}</td><td style={{ ...td, textAlign: "right" }}>{l.quantity}</td><td style={{ ...td, textAlign: "right" }}>{inr(l.unitPrice)}</td><td style={{ ...td, textAlign: "right" }}>{inr(l.lineTotal)}</td></tr>)}</tbody>
      </table>
      <p style={{ textAlign: "right", fontSize: 14, fontWeight: 700, margin: "10px 0 0" }}>Total {inr(d.subtotal)}</p>
      <p style={{ fontSize: 11, color: "#555", marginTop: 18 }}>Dispensed by {d.dispensedBy}. Please check the medicines before leaving the counter.</p>
    </div>
  );
}
