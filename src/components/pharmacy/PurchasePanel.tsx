"use client";

/**
 * The Purchase tab of Pharmacy: new purchase bills (cash or credit, with each medicine's manufacturer, HSN and Schedule H1 flag),
 * the list of bills, returning stock to a supplier, and the supplier credit it earns — a reminder of what is owed, taken off the next
 * bill for the same supplier and manufacturer, with the history of every movement.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pencil, Undo2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { formatDate } from "@/lib/dates";
import { downloadElement } from "@/lib/print";
import { RowMenu } from "@/components/shared/RowMenu";
import { Modal } from "@/components/shared/Modal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { DocumentLetterhead, DocumentFooter, useHospital } from "@/components/shared/DocumentLetterhead";
import { useSetup } from "@/components/setup/ui";
import type { PharmacyItemDTO, PurchaseOrderDTO, SupplierCreditBalanceDTO, SupplierCreditDTO } from "@/types/api";

const rupee = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.trim().toLowerCase();
const box = "text-[14px] text-[color:var(--ink)] bg-[color:var(--subtle)] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)]";
const ghostBtn = "text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors";
const primaryBtn = "text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50";

const PO_STATUS: Record<string, string> = { Received: "bg-[#dffff3] text-[#00955c]", Pending: "bg-[#fff2e0] text-[#ff9000]", Cancelled: "bg-[#ffe9e9] text-[#ff0004]" };
const ENTRY_TONE: Record<string, string> = { Return: "bg-[#dffff3] text-[#00955c]", Applied: "bg-[#fff2e0] text-[#c26a00]", Reversal: "bg-[#d6eaff] text-[#007cff]", Adjustment: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]" };
const ENTRY_LABEL: Record<string, string> = { Return: "Stock returned", Applied: "Used on a bill", Reversal: "Given back", Adjustment: "Adjustment" };

// ── Drafts ───────────────────────────────────────────────────────────────────

interface LineD { medicineName: string; pharmacyItemId?: number; manufacturer: string; hsn: string; isH1: boolean; quantity: string; price: string }
interface Draft { supplier: string; expectedDate: string; paymentType: "Cash" | "Credit"; useCredit: boolean; lines: LineD[] }
const blankLine = (): LineD => ({ medicineName: "", manufacturer: "", hsn: "", isH1: false, quantity: "", price: "" });
const blankDraft = (): Draft => ({ supplier: "", expectedDate: "", paymentType: "Cash", useCredit: true, lines: [blankLine()] });

const goodsTotal = (lines: LineD[]) => r2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0));

/** What the bill would use of the supplier's credit, per manufacturer — the server works it out again when the bill is saved. */
function previewCredit(d: Draft, balances: SupplierCreditBalanceDTO[], own: { manufacturer: string; amount: number }[] = []) {
  if (!d.useCredit || !d.supplier) return { rows: [] as { manufacturer: string; amount: number }[], total: 0 };
  const spend = new Map<string, { manufacturer: string; subtotal: number }>();
  for (const l of d.lines) {
    const k = norm(l.manufacturer);
    const cur = spend.get(k) ?? { manufacturer: l.manufacturer, subtotal: 0 };
    cur.subtotal = r2(cur.subtotal + (Number(l.quantity) || 0) * (Number(l.price) || 0));
    spend.set(k, cur);
  }
  const rows: { manufacturer: string; amount: number }[] = [];
  for (const [k, s] of spend) {
    const held = balances.filter((b) => norm(b.supplier) === norm(d.supplier) && norm(b.manufacturer) === k).reduce((n, b) => n + b.balance, 0)
      + own.filter((o) => norm(o.manufacturer) === k).reduce((n, o) => n + o.amount, 0);
    const amount = r2(Math.min(Math.max(held, 0), s.subtotal));
    if (amount > 0) rows.push({ manufacturer: s.manufacturer, amount });
  }
  return { rows, total: r2(rows.reduce((n, r) => n + r.amount, 0)) };
}

// ── Pickers ──────────────────────────────────────────────────────────────────

/** Search the inventory on the server as you type (the inventory can be many thousands of medicines). */
function StockPicker({ value, onPick, placeholder = "Search medicine" }: { value: string; onPick: (item: PharmacyItemDTO | null, text: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<PharmacyItemDTO[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = value.trim();
    if (term.length < 2 || !open) { if (term.length < 2) setFound([]); return; }
    timer.current = setTimeout(() => { api.list<PharmacyItemDTO>("/pharmacy", { search: term, pageSize: 8 }).then((r) => setFound(r.data)).catch(() => setFound([])); }, 220);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, open]);
  return (
    <div className="relative min-w-0">
      <input value={value} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => { onPick(null, e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={`${box} w-full`} />
      {open && found.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-[46px] max-h-[240px] overflow-y-auto bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[10px] shadow-lg">
          {found.map((m) => (
            <button key={m.id} type="button" onMouseDown={() => { onPick(m, m.name); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-[color:var(--subtle)] transition-colors">
              <span className="text-[13px] text-[color:var(--ink)]">{m.name}{m.isH1 && <span className="ml-2 rounded-full bg-[#ffe9e9] px-2 py-[1px] text-[10px] font-medium text-[#c8001a]">H1</span>}</span>
              <span className="block text-[11px] text-[color:var(--ink-soft)]">{m.stock} in stock · {m.manufacturer || "no manufacturer"} · {m.supplier || "no supplier"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── The bill's fields (new and edit) ─────────────────────────────────────────

function BillFields({ draft, setDraft, balances, own, suppliers, makers }: {
  draft: Draft; setDraft: (f: (d: Draft) => Draft) => void; balances: SupplierCreditBalanceDTO[]; own?: { manufacturer: string; amount: number }[];
  suppliers: string[]; makers: string[];
}) {
  const setLine = (i: number, patch: Partial<LineD>) => setDraft((d) => ({ ...d, lines: d.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) }));
  const total = goodsTotal(draft.lines);
  const credit = previewCredit(draft, balances, own);
  const net = r2(total - credit.total);
  // Credit held with this supplier per manufacturer — in an edit, counting what the bill itself already uses (it comes back when saved).
  const heldMap = new Map<string, { manufacturer: string; balance: number }>();
  if (draft.supplier) {
    for (const b of balances) if (norm(b.supplier) === norm(draft.supplier)) heldMap.set(norm(b.manufacturer), { manufacturer: b.manufacturer, balance: b.balance });
    for (const o of own ?? []) { const cur = heldMap.get(norm(o.manufacturer)) ?? { manufacturer: o.manufacturer, balance: 0 }; heldMap.set(norm(o.manufacturer), { ...cur, balance: r2(cur.balance + o.amount) }); }
  }
  const held = [...heldMap.values()].filter((b) => b.balance > 0.004);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
        <FormRow label="Supplier *">
          <FormSelect placeholder="Select supplier" value={draft.supplier} onChange={(v) => setDraft((d) => ({ ...d, supplier: v }))}
            options={[...suppliers.map((x) => ({ value: x, label: x })), ...(draft.supplier && !suppliers.includes(draft.supplier) ? [{ value: draft.supplier, label: draft.supplier }] : [])]} />
        </FormRow>
        <FormRow label="Expected Date"><FormInput type="date" value={draft.expectedDate} onChange={(v) => setDraft((d) => ({ ...d, expectedDate: v }))} /></FormRow>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3" data-testid="payment-type">
        <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Payment</span>
        <div role="radiogroup" aria-label="Cash or credit" className="inline-flex rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] p-[2px]">
          {(["Cash", "Credit"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={draft.paymentType === t} onClick={() => setDraft((d) => ({ ...d, paymentType: t }))}
              className={`h-[30px] rounded-[6px] px-4 text-[13px] cursor-pointer ${draft.paymentType === t ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{t}</button>
          ))}
        </div>
        <span className="text-[12px] text-[color:var(--ink-soft)]">{draft.paymentType === "Cash" ? "Paid to the supplier now." : "Paid to the supplier later; it stays unpaid until you mark it paid."}</span>
      </div>

      <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">Medicines</p>
      <div className="flex flex-col gap-3">
        {draft.lines.map((l, i) => (
          <div key={i} className="grid items-center gap-2 grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_96px_54px_84px_104px_32px]" data-testid="po-line">
            <div className="col-span-2 lg:col-span-1">
              <StockPicker value={l.medicineName} onPick={(m, text) => setLine(i, m
                ? { medicineName: text, pharmacyItemId: m.id, manufacturer: m.manufacturer || l.manufacturer, hsn: m.hsn || l.hsn, isH1: m.isH1 === true }
                : { medicineName: text, pharmacyItemId: undefined })} />
            </div>
            <div className="col-span-2 lg:col-span-1">
              <select value={l.manufacturer} onChange={(e) => setLine(i, { manufacturer: e.target.value })} aria-label="Manufacturer" className={`${box} w-full`}>
                <option value="">Manufacturer</option>
                {makers.map((m) => <option key={m} value={m}>{m}</option>)}
                {l.manufacturer && !makers.includes(l.manufacturer) && <option value={l.manufacturer}>{l.manufacturer}</option>}
              </select>
            </div>
            <input value={l.hsn} inputMode="numeric" maxLength={8} placeholder="HSN" aria-label="HSN code" onChange={(e) => setLine(i, { hsn: e.target.value.replace(/\D/g, "") })} className={`${box} w-full`} />
            <label className="flex items-center justify-center gap-1 text-[12px] text-[color:var(--ink)] cursor-pointer" title="Schedule H1 drug">
              <input type="checkbox" checked={l.isH1} onChange={(e) => setLine(i, { isH1: e.target.checked })} aria-label="Schedule H1 drug" /> H1
            </label>
            <input value={l.quantity} type="number" min={1} placeholder="Qty" aria-label="Quantity" onChange={(e) => setLine(i, { quantity: e.target.value })} className={`${box} w-full`} />
            <input value={l.price} type="number" min={0} placeholder="Unit ₹" aria-label="Unit cost" onChange={(e) => setLine(i, { price: e.target.value })} className={`${box} w-full`} />
            <button type="button" onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((_, n) => n !== i) }))} disabled={draft.lines.length === 1} aria-label="Remove medicine"
              className="text-[#c8c8cc] hover:text-[#ff0004] disabled:opacity-30 transition-colors">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, blankLine()] }))} className="mt-2 text-[12px] text-[color:var(--brand)] hover:underline">+ Add medicine</button>

      {/* Credit reminder for this supplier */}
      {draft.supplier && (
        <div className="mt-4 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-4 py-3 text-[13px]" data-testid="credit-reminder">
          {held.length === 0 ? (
            <span className="text-[color:var(--ink-soft)]">No supplier credit with {draft.supplier}.</span>
          ) : (
            <>
              <p className="font-medium text-[color:var(--ink)]">Credit with {draft.supplier} from stock returned earlier</p>
              <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[color:var(--ink)]">
                {held.map((b) => <li key={b.manufacturer}>{b.manufacturer || "No manufacturer"}: <b className="font-medium">{rupee(b.balance)}</b></li>)}
              </ul>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[color:var(--ink)]">
                <input type="checkbox" checked={draft.useCredit} onChange={(e) => setDraft((d) => ({ ...d, useCredit: e.target.checked }))} /> Take this credit off the bill (only for the same manufacturer)
              </label>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col items-end gap-1 text-[14px] text-[color:var(--ink)]">
        <span>Goods total: <b className="font-medium">{rupee(total)}</b></span>
        {credit.total > 0 && <span className="text-[#00955c]" data-testid="credit-used">Supplier credit used: −{rupee(credit.total)}{credit.rows.length > 1 ? ` (${credit.rows.map((r) => `${r.manufacturer || "—"} ${rupee(r.amount)}`).join(", ")})` : ""}</span>}
        <span className="text-[15px]">{draft.paymentType === "Credit" ? "To pay later" : "To pay now"}: <b className="font-medium text-[color:var(--brand)]" data-testid="net-payable">{rupee(net)}</b></span>
      </div>
    </>
  );
}

const draftBody = (d: Draft) => ({
  supplier: d.supplier, expectedDate: d.expectedDate, paymentType: d.paymentType, useCredit: d.useCredit,
  items: d.lines.filter((l) => l.medicineName.trim() && Number(l.quantity) > 0).map((l) => ({
    medicineName: l.medicineName, quantity: Number(l.quantity), unitCost: Number(l.price) || 0, pharmacyItemId: l.pharmacyItemId, manufacturer: l.manufacturer, hsn: l.hsn, isH1: l.isH1,
  })),
});

// ── Return stock to a supplier ───────────────────────────────────────────────

function ReturnDialog({ open, onClose, onDone, suppliers, makers }: { open: boolean; onClose: () => void; onDone: (message: string) => void; suppliers: string[]; makers: string[] }) {
  const [medicine, setMedicine] = useState("");
  const [item, setItem] = useState<PharmacyItemDTO | null>(null);
  const [supplier, setSupplier] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");
  const { run, loading, error, reset } = useMutation();

  useEffect(() => { if (open) { setMedicine(""); setItem(null); setSupplier(""); setManufacturer(""); setQty(""); setCost(""); setReason(""); reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = r2((Number(qty) || 0) * (Number(cost) || 0));
  const tooMany = !!item && Number(qty) > item.stock;
  const ok = !!item && !!supplier && Number(qty) >= 1 && Number.isInteger(Number(qty)) && !tooMany;

  async function submit() {
    if (!item) return;
    let res: { entry: SupplierCreditDTO; stockLeft: number; balance: number };
    try {
      res = await run(() => api.post<{ entry: SupplierCreditDTO; stockLeft: number; balance: number }>("/pharmacy/supplier-returns", {
        pharmacyItemId: item.id, quantity: Number(qty), supplier, manufacturer, reason, ...(cost !== "" ? { unitCost: Number(cost) } : {}),
      }));
    } catch { return; } // the dialog shows what went wrong
    onDone(`Returned ${res.entry.quantity} × ${res.entry.medicineName} to ${res.entry.supplier} (${res.entry.reference}). ${rupee(res.entry.amount)} credit added${res.entry.manufacturer ? ` for ${res.entry.manufacturer}` : ""}; credit with them is now ${rupee(res.balance)}. ${res.stockLeft} left in stock.`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Return stock to a supplier" subtitle="The stock leaves the shelf and the same amount becomes credit with this supplier and manufacturer, used on their next bill."
      footer={<><button onClick={onClose} className={ghostBtn}>Cancel</button><button onClick={() => void submit()} disabled={loading || !ok} className={primaryBtn}>{loading ? "Returning…" : "Return stock"}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormRow label="Medicine *">
            <StockPicker value={medicine} onPick={(m, text) => { setMedicine(text); setItem(m); if (m) { setSupplier(m.supplier || ""); setManufacturer(m.manufacturer || ""); } }} />
          </FormRow>
          {item && <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">{item.stock} in stock{item.supplier ? ` · supplied by ${item.supplier}` : ""}</p>}
        </div>
        <FormRow label="Supplier *">
          <FormSelect placeholder="Select supplier" value={supplier} onChange={setSupplier} options={[...suppliers.map((x) => ({ value: x, label: x })), ...(supplier && !suppliers.includes(supplier) ? [{ value: supplier, label: supplier }] : [])]} />
        </FormRow>
        <FormRow label="Manufacturer">
          <FormSelect placeholder="None" value={manufacturer} onChange={setManufacturer} options={[{ value: "", label: "None" }, ...makers.map((x) => ({ value: x, label: x })), ...(manufacturer && !makers.includes(manufacturer) ? [{ value: manufacturer, label: manufacturer }] : [])]} />
        </FormRow>
        <FormRow label="Quantity *" hint={tooMany ? `Only ${item?.stock} in stock` : undefined}><FormInput type="number" placeholder="0" value={qty} onChange={setQty} /></FormRow>
        <FormRow label="Cost per unit (₹)" hint="Leave empty to use the price of the last purchase."><FormInput type="number" placeholder="Last purchase price" value={cost} onChange={setCost} /></FormRow>
        <div className="sm:col-span-2"><FormRow label="Reason"><FormInput placeholder="e.g. Near expiry, damaged, wrong item" value={reason} onChange={setReason} /></FormRow></div>
      </div>
      {amount > 0 && <p className="mt-3 text-[13px] text-[color:var(--ink)]">Credit earned: <b className="font-medium text-[#00955c]">{rupee(amount)}</b></p>}
      {error && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2" role="alert">{error.message}</div>}
    </Modal>
  );
}

// ── The tab ──────────────────────────────────────────────────────────────────

export function PurchasePanel({ onChanged }: { onChanged: () => void }) {
  const { items: orders, reload } = useList<PurchaseOrderDTO>("/pharmacy/purchase-orders", { all: true });
  const { items: history, reload: reloadHistory } = useList<SupplierCreditDTO>("/pharmacy/supplier-credits", { all: true });
  const supplierMaster = useSetup("supplier");
  const makerMaster = useSetup("manufacturer");
  const suppliers = supplierMaster.items.filter((s) => s.active).map((s) => s.name);
  const makers = makerMaster.items.filter((m) => m.active).map((m) => m.name);
  const hospital = useHospital();
  const poDocRef = useRef<HTMLDivElement>(null);
  const { run, loading, error, reset } = useMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const [balances, setBalances] = useState<SupplierCreditBalanceDTO[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [returning, setReturning] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");

  const [viewing, setViewing] = useState<PurchaseOrderDTO | null>(null);
  const [editing, setEditing] = useState<PurchaseOrderDTO | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(blankDraft);
  const { run: runEdit, loading: editLoading, error: editError, reset: resetEdit } = useMutation();

  const loadBalances = useCallback(async () => {
    try { setBalances(await api.get<SupplierCreditBalanceDTO[]>("/pharmacy/supplier-credits/balances")); } catch { setBalances([]); }
  }, []);
  useEffect(() => { void loadBalances(); }, [loadBalances]);
  const refreshAll = () => { reload(); reloadHistory(); void loadBalances(); onChanged(); };

  // The credit a bill already uses (by manufacturer), so an edit's preview counts it as available again.
  const ownCredit = (poId: number) => {
    const per = new Map<string, number>();
    for (const h of history) if (h.purchaseOrderId === poId && (h.entryType === "Applied" || h.entryType === "Reversal")) per.set(h.manufacturer, (per.get(h.manufacturer) ?? 0) - h.amount);
    return [...per.entries()].filter(([, v]) => v > 0.004).map(([manufacturer, amount]) => ({ manufacturer, amount: r2(amount) }));
  };

  async function createPO() {
    let res: PurchaseOrderDTO;
    try { res = await run(() => api.post<PurchaseOrderDTO>("/pharmacy/purchase-orders", draftBody(draft))); } catch { return; } // the form shows what went wrong
    setNotice(`${res.poNumber} created${res.creditApplied > 0 ? ` — ${rupee(res.creditApplied)} supplier credit taken off; ${rupee(res.netPayable)} ${res.paymentType === "Credit" ? "to pay later" : "to pay now"}` : ""}.`);
    setDraft(blankDraft());
    refreshAll();
  }

  function openEdit(po: PurchaseOrderDTO) {
    resetEdit();
    setEditing(po);
    setEditDraft({
      supplier: po.supplier, expectedDate: po.expectedDate ?? "", paymentType: po.paymentType, useCredit: true,
      lines: po.items.map((it) => ({ medicineName: it.medicineName, manufacturer: it.manufacturer, hsn: it.hsn, isH1: it.isH1, quantity: String(it.quantity), price: String(it.unitCost) })),
    });
  }

  async function saveEdit() {
    if (!editing) return;
    // Keep the link to the inventory item for lines that weren't changed.
    const withIds = { ...editDraft, lines: editDraft.lines.map((l) => ({ ...l, pharmacyItemId: l.pharmacyItemId ?? editing.items.find((i) => i.medicineName === l.medicineName)?.id })) };
    const body = draftBody(withIds);
    try { await runEdit(() => api.patch<PurchaseOrderDTO>(`/pharmacy/purchase-orders/${editing.id}`, body)); } catch { return; } // the dialog shows what went wrong
    setEditing(null);
    refreshAll();
  }

  async function receive(po: PurchaseOrderDTO) {
    const res = await api.post<PurchaseOrderDTO & { receipt?: { applied: { name: string; added: number }[]; unmatched: string[] } }>(`/pharmacy/purchase-orders/${po.id}/receive`);
    const r = res?.receipt;
    const parts: string[] = [];
    if (r?.applied?.length) parts.push(`Stock increased: ${r.applied.map((a) => `${a.name} (+${a.added})`).join(", ")}.`);
    if (r?.unmatched?.length) parts.push(`Not in inventory: ${r.unmatched.join(", ")}.`);
    setNotice(parts.join(" ") || "Purchase order received.");
    refreshAll();
  }

  async function act(label: string, path: string, method: "post" | "patch" = "post", body?: unknown) {
    try {
      await (method === "post" ? api.post(path, body) : api.patch(path, body));
      setNotice(label);
      refreshAll();
    } catch (e) { setNotice(e instanceof Error ? e.message : "That didn't work."); }
  }

  const totalCredit = r2(balances.filter((b) => b.balance > 0).reduce((n, b) => n + b.balance, 0));
  const shownHistory = history.filter((h) => !historyFilter || norm(h.supplier) === norm(historyFilter));

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* View bill */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Purchase Order — ${viewing.poNumber}` : ""} width={780}
        footer={viewing && (
          <>
            <button onClick={() => void downloadElement(poDocRef.current, viewing.poNumber)} className="flex items-center gap-2 text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-4 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors"><Download size={14} /> Download</button>
            {viewing.status === "Pending" && <button onClick={() => { openEdit(viewing); setViewing(null); }} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors"><Pencil size={14} /> Edit</button>}
          </>
        )}>
        {viewing && (
          <div ref={poDocRef} className="border border-[color:var(--line)] rounded-[12px] overflow-hidden">
            <DocumentLetterhead hospital={hospital} compact right={<>
              <div className="text-[18px] font-medium text-[color:var(--ink)]">{viewing.poNumber}</div>
              <div className="text-[12px] font-light text-[color:var(--ink-soft)] mt-1">Order date: {formatDate(viewing.orderDate)}</div>
              {viewing.expectedDate && <div className="text-[12px] font-light text-[color:var(--ink-soft)]">Expected: {formatDate(viewing.expectedDate)}</div>}
              <div className="mt-2"><StatusBadge status={viewing.status} /></div>
            </>} />
            <div className="px-4 py-6 sm:px-8">
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div><p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-1">Supplier</p><p className="text-[14px] font-medium text-[color:var(--ink)]">{viewing.supplier}</p></div>
                <div><p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-1">Payment</p><p className="text-[14px] font-medium text-[color:var(--ink)]">{viewing.paymentType} · {viewing.paymentStatus}</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead><tr className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider" style={{ borderBottom: "1px solid var(--line)" }}>
                    <th className="text-left pb-2">#</th><th className="text-left pb-2">Medicine</th><th className="text-left pb-2">Manufacturer</th><th className="text-left pb-2">HSN</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Unit ₹</th><th className="text-right pb-2">Amount ₹</th>
                  </tr></thead>
                  <tbody>
                    {viewing.items.map((it, i) => (
                      <tr key={it.id} className="text-[13px]" style={{ borderBottom: "1px solid var(--subtle-2)" }}>
                        <td className="py-2 text-[color:var(--ink-soft)]">{i + 1}</td>
                        <td className="py-2 text-[color:var(--ink)]">{it.medicineName}{it.isH1 && <span className="ml-2 rounded-full bg-[#ffe9e9] px-2 py-[1px] text-[10px] font-medium text-[#c8001a]">H1</span>}</td>
                        <td className="py-2 text-[color:var(--ink-soft)]">{it.manufacturer || "—"}</td>
                        <td className="py-2 text-[color:var(--ink-soft)]">{it.hsn || "—"}</td>
                        <td className="py-2 text-right text-[color:var(--ink-soft)]">{it.quantity}</td>
                        <td className="py-2 text-right text-[color:var(--ink-soft)]">{it.unitCost.toLocaleString("en-IN")}</td>
                        <td className="py-2 text-right text-[color:var(--ink)] font-medium">{(it.quantity * it.unitCost).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col items-end gap-1 text-[14px] text-[color:var(--ink)]">
                <span>Goods total: {rupee(viewing.total)}</span>
                {viewing.creditApplied > 0 && <span className="text-[#00955c]">Supplier credit used: −{rupee(viewing.creditApplied)}</span>}
                <span className="text-[15px] font-medium">{viewing.paymentType === "Credit" ? "Payable later" : "Paid now"}: <span className="text-[color:var(--brand)]">{rupee(viewing.netPayable)}</span></span>
              </div>
            </div>
            <DocumentFooter hospital={hospital} />
          </div>
        )}
      </Modal>

      {/* Edit bill */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit — ${editing.poNumber}` : ""} width={900}
        footer={<><button onClick={() => setEditing(null)} className={ghostBtn}>Cancel</button><button onClick={() => void saveEdit()} disabled={editLoading || !editDraft.supplier} className={primaryBtn}>{editLoading ? "Saving…" : "Save Changes"}</button></>}>
        {editing && <BillFields draft={editDraft} setDraft={(f) => setEditDraft(f)} balances={balances} own={ownCredit(editing.id)} suppliers={suppliers} makers={makers} />}
        {editError && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2" role="alert">{editError.message}</div>}
      </Modal>

      <ReturnDialog open={returning} onClose={() => setReturning(false)} suppliers={suppliers} makers={makers} onDone={(m) => { setNotice(m); refreshAll(); }} />

      {/* Credit reminder */}
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[color:var(--line)] px-4 py-3" data-testid="credit-summary">
        <div className="min-w-[220px] flex-1 basis-[220px]">
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Supplier credit {totalCredit > 0 && <span className="ml-1 rounded-full bg-[#dffff3] px-2 py-[2px] text-[12px] text-[#00955c]">{rupee(totalCredit)}</span>}</p>
          {totalCredit > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[color:var(--ink-soft)]">
              {balances.filter((b) => b.balance > 0).map((b) => <li key={`${b.supplier}|${b.manufacturer}`}><b className="font-medium text-[color:var(--ink)]">{b.supplier}</b> · {b.manufacturer || "no manufacturer"}: {rupee(b.balance)}</li>)}
            </ul>
          ) : <p className="text-[12px] text-[color:var(--ink-soft)]">Stock sent back to a supplier earns credit that is taken off your next bill with them for the same manufacturer.</p>}
        </div>
        <button onClick={() => setReturning(true)} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer"><Undo2 size={14} /> Return stock to supplier</button>
      </div>

      <div className="border border-[color:var(--line)] rounded-[10px] p-5">
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-4">New Purchase Order</h3>
        <BillFields draft={draft} setDraft={(f) => { reset(); setDraft(f); }} balances={balances} suppliers={suppliers} makers={makers} />
        {error && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2" role="alert">{error.message}</div>}
        <div className="flex justify-end mt-4">
          <button onClick={() => void createPO()} disabled={loading || !draft.supplier} className="bg-[color:var(--brand)] text-white text-[14px] font-normal px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Creating…" : "Create PO"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 text-[13px] text-[color:var(--ink)] bg-[color:var(--brand-soft)] border border-[#b8e5e6] rounded-[10px] px-4 py-3" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-[color:var(--ink-soft)] shrink-0" aria-label="Dismiss">✕</button>
        </div>
      )}

      <div>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-3">Purchase Orders</h3>
        <div className="overflow-x-auto border border-[color:var(--line)] rounded-[10px]">
          <div className="min-w-[1040px]">
            <div className="grid items-center px-4 h-10 bg-[color:var(--subtle-3)] text-[12px] font-medium text-[color:var(--ink)]" style={{ gridTemplateColumns: "100px 1.3fr 100px 60px 110px 130px 100px 190px" }}>
              <span>PO Number</span><span>Supplier</span><span>Date</span><span>Items</span><span>Total</span><span>Payment</span><span>Status</span><span>Action</span>
            </div>
            {orders.length === 0 && <div className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">No purchase orders yet.</div>}
            {orders.map((po) => (
              <div key={po.id} className="grid items-center px-4 min-h-[56px] py-1 border-b border-[color:var(--subtle-2)] last:border-0 bg-[color:var(--surface)] hover:bg-[color:var(--faint)] transition-colors" style={{ gridTemplateColumns: "100px 1.3fr 100px 60px 110px 130px 100px 190px" }}>
                <span className="text-[13px] font-medium text-[color:var(--brand)]">{po.poNumber}</span>
                <span className="text-[13px] text-[color:var(--ink)] truncate">{po.supplier}</span>
                <span className="text-[13px] text-[color:var(--ink-soft)]">{formatDate(po.orderDate)}</span>
                <span className="text-[13px] text-[color:var(--ink-soft)]">{po.itemCount}</span>
                <span className="text-[13px] font-medium text-[color:var(--ink)]">{rupee(po.total)}{po.creditApplied > 0 && <span className="block text-[11px] font-normal text-[#00955c]">−{rupee(po.creditApplied)} credit</span>}</span>
                <span className="text-[12px]"><span className={`inline-flex rounded-full px-2 py-[2px] ${po.paymentType === "Credit" ? "bg-[#ede9ff] text-[#6b4eff]" : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>{po.paymentType}</span>{" "}
                  <span className={po.paymentStatus === "Unpaid" && po.status !== "Cancelled" ? "text-[#c26a00]" : "text-[color:var(--ink-soft)]"}>{po.status === "Cancelled" ? "—" : po.paymentStatus === "Unpaid" ? `${rupee(po.netPayable)} due` : "Paid"}</span></span>
                <span className={`inline-flex w-fit items-center px-[10px] py-[4px] rounded-full text-[11px] ${PO_STATUS[po.status] ?? ""}`}>{po.status}</span>
                <div className="flex items-center gap-2 justify-end">
                  {po.status === "Pending" && <button onClick={() => void receive(po)} className="text-[12px] text-white bg-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors whitespace-nowrap">Receive stock</button>}
                  {po.paymentStatus === "Unpaid" && po.status !== "Cancelled" && <button onClick={() => void act(`${po.poNumber} marked paid.`, `/pharmacy/purchase-orders/${po.id}/pay`)} className="text-[12px] text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[4px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap">Mark paid</button>}
                  <RowMenu actions={[
                    { label: "View", onClick: () => setViewing(po) },
                    { label: "Edit", disabled: po.status !== "Pending", onClick: () => openEdit(po) },
                    { label: "Download bill", onClick: () => { setViewing(po); window.setTimeout(() => void downloadElement(poDocRef.current, po.poNumber), 400); } },
                    { label: "Cancel bill", danger: true, disabled: po.status !== "Pending", onClick: () => void act(`${po.poNumber} cancelled${po.creditApplied > 0 ? `; ${rupee(po.creditApplied)} supplier credit given back` : ""}.`, `/pharmacy/purchase-orders/${po.id}`, "patch", { status: "Cancelled" }) },
                  ]} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Credit history */}
      <div data-testid="credit-history">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-[14px] font-medium text-[color:var(--ink)]">Supplier credit history</h3>
          <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} aria-label="Filter by supplier" className="h-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px]">
            <option value="">All suppliers</option>
            {[...new Set(history.map((h) => h.supplier))].sort().map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto border border-[color:var(--line)] rounded-[10px]">
          <table data-keep-table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-[color:var(--subtle-3)] text-[12px] text-[color:var(--ink)]"><tr>
              <th className="px-4 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">What</th><th className="px-3 py-2 font-medium">Supplier</th><th className="px-3 py-2 font-medium">Manufacturer</th><th className="px-3 py-2 font-medium">Medicine</th><th className="px-3 py-2 font-medium">Ref.</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">By</th>
            </tr></thead>
            <tbody>
              {shownHistory.map((h) => (
                <tr key={h.id} className="border-t border-[color:var(--subtle-2)]">
                  <td className="px-4 py-2 whitespace-nowrap text-[color:var(--ink-soft)]">{formatDate((h.createdAt ?? "").slice(0, 10))}</td>
                  <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-[2px] text-[11px] ${ENTRY_TONE[h.entryType] ?? ""}`}>{ENTRY_LABEL[h.entryType] ?? h.entryType}</span></td>
                  <td className="px-3 py-2 text-[color:var(--ink)]">{h.supplier}</td>
                  <td className="px-3 py-2 text-[color:var(--ink-soft)]">{h.manufacturer || "—"}</td>
                  <td className="px-3 py-2 text-[color:var(--ink-soft)]">{h.medicineName ? `${h.medicineName}${h.quantity ? ` × ${h.quantity}` : ""}` : h.reason || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-[color:var(--ink-soft)]">{h.reference}</td>
                  <td className={`px-3 py-2 text-right font-medium ${h.amount >= 0 ? "text-[#00955c]" : "text-[#c26a00]"}`}>{h.amount >= 0 ? "+" : "−"}{rupee(Math.abs(h.amount))}</td>
                  <td className="px-3 py-2 text-[color:var(--ink-soft)]">{h.createdBy || "—"}</td>
                </tr>
              ))}
              {shownHistory.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--ink-soft)]">No returns or credit used yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
