"use client";

/**
 * The dispensing counter: choose a patient (or none, for over-the-counter), optionally load their prescription, add medicines from
 * stock, pick how it is billed, and dispense. Recent dispensing sits underneath with Print and Return.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { DispenseBilling, DispenseDTO, DispenseRxDTO, DispenseStockDTO, PatientDTO } from "@/types/api";
import { inr } from "@/types/setup";
import { ErrorNote, outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { RecentDispensing } from "@/components/dispense/RecentDispensing";

interface CartLine { itemId: number; name: string; available: number; qty: string; price: string }

const BILLING: { id: DispenseBilling; label: string; needsPatient: boolean }[] = [
  { id: "separate", label: "Separate bill", needsPatient: true },
  { id: "patient", label: "Add to patient's bill", needsPatient: true },
  { id: "none", label: "No bill", needsPatient: false },
];

export function DispenseScreen() {
  const { can } = useAuth();
  const canWrite = can("pharmacy", "write");
  const recent = useList<DispenseDTO>("/pharmacy/dispense", { limit: 30 });
  const patients = useList<PatientDTO>("/patients", { all: true });
  const [patient, setPatient] = useState<PatientDTO | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [find, setFind] = useState("");
  const [note, setNote] = useState("");
  const [billing, setBilling] = useState<DispenseBilling>("none");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drug, setDrug] = useState("");
  const [chips, setChips] = useState<DispenseStockDTO[]>([]);
  const [chipsOpen, setChipsOpen] = useState(false);
  const [rx, setRx] = useState<DispenseRxDTO[]>([]);
  const [rxId, setRxId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<DispenseDTO | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { run, loading, error, reset } = useMutation();

  const total = cart.reduce((n, l) => n + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const q = find.trim().toLowerCase();
  const matches = patients.items.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q) || (p.patientId ?? "").toLowerCase().includes(q)).slice(0, 8);

  async function searchStock(text: string) {
    try { setChips(await api.get<DispenseStockDTO[]>("/pharmacy/dispense/stock", { q: text })); } catch { setChips([]); }
  }
  function onDrugChange(v: string) {
    setDrug(v); setChipsOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => searchStock(v), 180);
  }
  function addStock(s: DispenseStockDTO) {
    setDone(null);
    setCart((c) => c.some((l) => l.itemId === s.itemId) ? c.map((l) => (l.itemId === s.itemId ? { ...l, qty: String(Math.min(s.available, (Number(l.qty) || 0) + 1)) } : l)) : [...c, { itemId: s.itemId, name: s.name, available: s.available, qty: "1", price: s.unitPrice > 0 ? String(s.unitPrice) : "" }]);
    setDrug(""); setChipsOpen(false);
  }
  async function choosePatient(p: PatientDTO | null) {
    setPatient(p); setPickerOpen(false); setFind(""); setRx([]); setRxId(null); setNotice(null);
    if (!p) { setBilling("none"); return; }
    try { setRx(await api.get<DispenseRxDTO[]>("/pharmacy/dispense/rx", { patientId: p.id })); } catch { setRx([]); }
  }
  function loadRx(r: DispenseRxDTO) {
    setDone(null);
    const missing: string[] = [];
    const next = [...cart];
    for (const l of r.lines) {
      if (l.itemId === null || l.available <= 0) { missing.push(l.medicineName); continue; }
      const qty = Math.min(l.quantity, l.available);
      const at = next.findIndex((c) => c.itemId === l.itemId);
      if (at >= 0) next[at] = { ...next[at], qty: String(Math.min(l.available, (Number(next[at].qty) || 0) + qty)) };
      else next.push({ itemId: l.itemId, name: l.itemName, available: l.available, qty: String(qty), price: l.unitPrice > 0 ? String(l.unitPrice) : "" });
    }
    setCart(next); setRxId(r.prescriptionId);
    setNotice(missing.length ? `Not in stock or not stocked: ${missing.join(", ")}.` : null);
  }
  const patchLine = (id: number, p: Partial<CartLine>) => setCart((c) => c.map((l) => (l.itemId === id ? { ...l, ...p } : l)));

  const bad = cart.some((l) => { const n = Number(l.qty); return !Number.isInteger(n) || n < 1 || n > l.available; });
  async function dispense() {
    reset(); setDone(null);
    let result: DispenseDTO | null = null;
    const ok = await attempt(run(async () => {
      result = await api.post<DispenseDTO>("/pharmacy/dispense", {
        patientId: patient?.id, walkInNote: patient ? "" : note, prescriptionId: rxId ?? undefined, billing,
        lines: cart.map((l) => ({ itemId: l.itemId, quantity: Number(l.qty), unitPrice: l.price === "" ? undefined : Number(l.price) })),
      });
    }));
    if (ok && result) {
      setDone(result); setCart([]); setRxId(null); setNotice(null); setNote("");
      if (patient) { try { setRx(await api.get<DispenseRxDTO[]>("/pharmacy/dispense/rx", { patientId: patient.id })); } catch { setRx([]); } }
      recent.reload();
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <div className="relative">
          <button onClick={() => setPickerOpen(!pickerOpen)} aria-haspopup="listbox" aria-expanded={pickerOpen} className="flex h-[36px] w-[210px] items-center justify-between rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[14px] cursor-pointer">
            <span className="truncate">{patient ? patient.name : "No patient (OTC)"}</span><ChevronsUpDown size={14} className="text-[color:var(--ink-soft)]" />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-[40px] z-30 w-[300px] rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-2 shadow-lg">
              <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder="Name, mobile or UHID…" aria-label="Find a patient" className="mb-1 h-[34px] w-full rounded-[6px] bg-[color:var(--subtle)] px-3 text-[13px] focus:outline-none" />
              <ul role="listbox" className="max-h-[260px] overflow-y-auto">
                <li><button onClick={() => choosePatient(null)} className="flex w-full items-center gap-2 rounded-[6px] px-2 py-[7px] text-left text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer">{!patient && <Check size={13} />}<span className={patient ? "pl-5" : ""}>No patient (OTC)</span></button></li>
                {matches.map((p) => (
                  <li key={p.id}><button onClick={() => choosePatient(p)} className="flex w-full items-center gap-2 rounded-[6px] px-2 py-[7px] text-left text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer">{patient?.id === p.id && <Check size={13} />}<span className={`min-w-0 flex-1 truncate ${patient?.id === p.id ? "" : "pl-5"}`}>{p.name}</span><span className="font-mono text-[11px] text-[color:var(--ink-soft)]">{p.patientId ?? p.phone}</span></button></li>
                ))}
              </ul>
              <Link href="/patients/new?from=dispense" className="mt-1 flex items-center gap-2 border-t border-[color:var(--line)] px-2 pt-2 text-[13px] text-[color:var(--brand)] hover:underline"><UserPlus size={13} /> Register patient</Link>
            </div>
          )}
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} disabled={!!patient} placeholder="Walk-in note (name / ref).." aria-label="Walk-in note" className="h-[36px] min-w-[180px] flex-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[14px] disabled:opacity-50 focus:border-[color:var(--brand)] focus:outline-none" />
        <div className="relative min-w-[220px] flex-1">
          <input value={drug} onChange={(e) => onDrugChange(e.target.value)} onFocus={() => { setChipsOpen(true); searchStock(drug); }} onBlur={() => setTimeout(() => setChipsOpen(false), 150)} placeholder="Add drug from stock..." aria-label="Add drug from stock" disabled={!canWrite} className="h-[36px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[14px] focus:border-[color:var(--brand)] focus:outline-none" />
        </div>
        <div role="radiogroup" aria-label="Billing" className="inline-flex rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] p-[2px]">
          {BILLING.map((b) => {
            const off = b.needsPatient && !patient;
            return <button key={b.id} role="radio" aria-checked={billing === b.id} disabled={off} onClick={() => setBilling(b.id)} className={`h-[30px] rounded-[6px] px-3 text-[12px] whitespace-nowrap ${billing === b.id ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"} ${off ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}>{b.label}</button>;
          })}
        </div>
      </div>
      {chipsOpen && chips.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pt-2" onMouseDown={(e) => e.preventDefault()}>
          {chips.map((s) => <button key={s.itemId} onClick={() => addStock(s)} className="rounded-full border border-[color:var(--line)] px-3 py-[4px] text-[12px] hover:bg-[color:var(--subtle)] cursor-pointer">{s.name} <span className="text-[color:var(--ink-soft)]">· {s.available}</span></button>)}
        </div>
      )}

      {rx.length > 0 && (
        <div className="mx-5 mt-3 flex flex-wrap gap-2" aria-label="Prescriptions">
          {rx.map((r) => (
            <div key={r.prescriptionId} className={`flex items-center gap-3 rounded-[8px] border px-3 py-[6px] text-[13px] ${rxId === r.prescriptionId ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]" : "border-[color:var(--line)]"}`}>
              <span><span className="font-mono text-[12px]">{r.rxNumber}</span> · {r.doctor} · {r.lines.length} {r.lines.length === 1 ? "medicine" : "medicines"}</span>
              <button onClick={() => loadRx(r)} className="font-medium text-[color:var(--brand)] hover:underline cursor-pointer">{rxId === r.prescriptionId ? "Loaded" : "Load Rx"}</button>
            </div>
          ))}
        </div>
      )}
      {notice && <p role="status" className="mx-5 mt-3 rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[13px] text-[#8a5300]">{notice}</p>}
      {done && (
        <div role="status" className="mx-5 mt-3 rounded-[8px] bg-[#dffff3] px-3 py-2 text-[13px] text-[#0b7a47]">
          Dispensed <span className="font-mono">{done.dispenseNo}</span> · {inr(done.subtotal)} · {done.billLabel}.
          {done.billingWarning && <span className="mt-1 block text-[#8a5300]">{done.billingWarning}</span>}
        </div>
      )}

      <div className="px-5 pt-3" style={{ minHeight: 280 }}>
        {cart.length === 0 ? (
          <div className="flex min-h-[110px] items-center justify-center rounded-[10px] border border-dashed border-[color:var(--line)] text-[14px] text-[color:var(--ink-soft)]">Scan a patient and load their Rx, or search stock to add medicines.</div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
            <table className="w-full min-w-[620px] text-left text-[13px]">
              <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)] text-[12px] text-[color:var(--ink-soft)]"><th className="px-3 py-2 font-medium">Medicine</th><th className="w-[90px] px-2 font-medium">In stock</th><th className="w-[90px] px-2 font-medium">Qty</th><th className="w-[110px] px-2 font-medium">Price (₹)</th><th className="w-[110px] px-2 text-right font-medium">Amount</th><th className="w-[40px]" /></tr></thead>
              <tbody>
                {cart.map((l) => {
                  const n = Number(l.qty);
                  const over = !Number.isInteger(n) || n < 1 || n > l.available;
                  return (
                    <tr key={l.itemId} className="border-b border-[color:var(--line)] last:border-b-0">
                      <td className="px-3 py-2 font-medium">{l.name}</td>
                      <td className="px-2 font-mono text-[12px] text-[color:var(--ink-soft)]">{l.available}</td>
                      <td className="px-2"><input aria-label={`${l.name} quantity`} type="number" min={1} max={l.available} value={l.qty} onChange={(e) => patchLine(l.itemId, { qty: e.target.value })} className={`h-[32px] w-[70px] rounded-[6px] border px-2 text-right font-mono ${over ? "border-[#c8001a]" : "border-[color:var(--line)]"}`} /></td>
                      <td className="px-2"><input aria-label={`${l.name} price`} type="number" min={0} step="0.01" value={l.price} placeholder="0.00" onChange={(e) => patchLine(l.itemId, { price: e.target.value })} className="h-[32px] w-[90px] rounded-[6px] border border-[color:var(--line)] px-2 text-right font-mono" /></td>
                      <td className="px-2 text-right font-mono">{inr((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
                      <td><button aria-label={`Remove ${l.name}`} onClick={() => setCart((c) => c.filter((x) => x.itemId !== l.itemId))} className="p-2 text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2"><ErrorNote message={error?.message} /></div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-[color:var(--line)] px-5 py-3">
        <span className="text-[13px] text-[color:var(--ink-soft)]">{cart.length} {cart.length === 1 ? "item" : "items"}</span>
        {cart.length > 0 && <button onClick={() => { setCart([]); setRxId(null); setNotice(null); }} className={outlineBtn + " !h-[30px]"}>Clear</button>}
        <span className="ml-auto font-mono text-[16px] font-bold">{inr(total)}</span>
        <button onClick={dispense} disabled={!canWrite || loading || cart.length === 0 || bad} className={primaryBtn}><Plus size={14} /> {loading ? "Dispensing…" : "Dispense"}</button>
      </div>

      <RecentDispensing items={recent.items} canWrite={canWrite} onChanged={recent.reload} />
    </div>
  );
}
