"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tw } from "@/lib/design-system";
import { Pill, Plus, MoreVertical, AlertTriangle, Clock, XCircle, TrendingDown, Pencil, Download } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { parseMonthYear, parseDisplayDate, formatDate } from "@/lib/dates";
import { downloadElement } from "@/lib/print";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { PharmacyItemDTO, PurchaseOrderDTO, PharmacySaleDTO, PatientDTO, PrescriptionDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { DocumentLetterhead, DocumentFooter, useHospital } from "@/components/shared/DocumentLetterhead";
import type { PharmacyItem } from "@/types";

// ─── Inventory ────────────────────────────────────────────────────────────────

const INV_COLUMNS = [
  { label: "Medicine",  width: "minmax(160px,1.5fr)" },
  { label: "Category",  width: "minmax(120px,1fr)" },
  { label: "Stock",     width: "100px" },
  { label: "Min Stock", width: "90px" },
  { label: "Expiry",    width: "110px" },
  { label: "Supplier",  width: "minmax(140px,1.2fr)" },
  { label: "Status",    width: "120px" },
  { label: "Action",    width: "52px", align: "right" as const },
];
const INV_FILTERS = [
  { id: "All", label: "All" }, { id: "InStock", label: "In Stock" },
  { id: "LowStock", label: "Low Stock" }, { id: "OutOfStock", label: "Out of Stock" },
  { id: "Expired", label: "Expired" },
];
const MIN_WIDTH = 1120;

function InventoryRow({ row, actions }: { row: PharmacyItem; actions: RowAction[] }) {
  const isLow = row.stock < row.minStock && row.stock > 0;
  const isOut = row.stock === 0;
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[#57575f] truncate">{row.category}</span>
      <span className={`text-[13px] font-medium ${isOut ? "text-[#ff0004]" : isLow ? "text-[#ff9000]" : "text-[#11111c]"}`}>
        {row.stock} units
      </span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.minStock}</span>
      <span className={`text-[13px] font-normal whitespace-nowrap ${row.status === "Expired" ? "text-[#ff0004]" : "text-[#11111c]"}`}>{row.expiryDate}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.supplier}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

const PO_STATUS: Record<string, string> = {
  Received: "bg-[#dffff3] text-[#00955c]",
  Pending:  "bg-[#fff2e0] text-[#ff9000]",
  Cancelled:"bg-[#ffe9e9] text-[#ff0004]",
};

interface Line { medicineName: string; quantity: string; price: string; pharmacyItemId?: number }

/** Comparable form of a medicine name: lowercase, no strength or packaging — mirrors the server's rx-to-stock matching. */
function medicineKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|ml|g|iu|%)\b/g, " ")
    .replace(/\b(tablet|tab|capsule|cap|syrup|injection|inj|drops?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Units to dispense from frequency × duration, e.g. "1-0-1" over "5 days" → 10. */
function unitsFor(frequency: string, duration: string): number {
  const freqText = (frequency ?? "").toLowerCase();
  let perDay = 0;
  const dashed = freqText.match(/\d\s*-\s*\d\s*-\s*\d(\s*-\s*\d)?/);
  if (dashed) perDay = dashed[0].split("-").reduce((sum, n) => sum + (Number(n.trim()) || 0), 0);
  else if (/(once|1\s*(time|x)|od\b)/.test(freqText)) perDay = 1;
  else if (/(twice|2\s*(times|x)|bd\b|bid\b)/.test(freqText)) perDay = 2;
  else if (/(thrice|3\s*(times|x)|tds\b|tid\b)/.test(freqText)) perDay = 3;
  else if (/(4\s*(times|x)|qds\b|qid\b)/.test(freqText)) perDay = 4;
  const days = Number((duration ?? "").match(/\d+/)?.[0] ?? 0);
  const total = perDay * days;
  return total > 0 ? total : 1;
}

/** Find this medicine in pharmacy stock — exact name first, then a normalized fuzzy match. */
function findStockMatch(items: PharmacyItemDTO[], medicineName: string): PharmacyItemDTO | undefined {
  return items.find(s => s.name === medicineName) ?? items.find(s => medicineKey(s.name) === medicineKey(medicineName));
}

/** Searchable medicine picker backed by real pharmacy inventory. */
function MedicinePicker({
  items, value, onPick, placeholder = "Search medicine",
}: {
  items: PharmacyItemDTO[];
  value: string;
  onPick: (item: PharmacyItemDTO | null, text: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = value.trim()
    ? items.filter(i => i.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : items.slice(0, 8);

  return (
    <div className="relative">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onPick(null, e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className="w-full text-[14px] text-[#11111c] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-[46px] max-h-[220px] overflow-y-auto bg-white border border-[#dedee1] rounded-[10px] shadow-lg">
          {matches.map(m => (
            <button key={m.id} type="button"
              onMouseDown={() => { onPick(m, m.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-[#f6f6f6] transition-colors">
              <span className="text-[13px] text-[#11111c]">{m.name}</span>
              <span className="block text-[11px] text-[#57575f]">
                {m.stock} in stock · {m.category} · {m.supplier}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseView({ items, onChanged }: { items: PharmacyItemDTO[]; onChanged: () => void }) {
  const { items: orders, reload } = useList<PurchaseOrderDTO>("/pharmacy/purchase-orders", { all: true });
  const { run, loading, error } = useMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const suppliers = [...new Set(items.map(i => i.supplier).filter(Boolean))].sort();
  const hospital = useHospital();
  const poDocRef = useRef<HTMLDivElement>(null);

  const [supplier, setSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<Line[]>([{ medicineName: "", quantity: "", price: "" }]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);

  // View / Edit dialogs
  const [viewingPO, setViewingPO] = useState<PurchaseOrderDTO | null>(null);
  const [pendingPODownload, setPendingPODownload] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderDTO | null>(null);
  const [editSupplier, setEditSupplier] = useState("");
  const [editExpectedDate, setEditExpectedDate] = useState("");
  const [editLines, setEditLines] = useState<Line[]>([]);
  const { run: runEdit, loading: editLoading, error: editError } = useMutation();

  useEffect(() => {
    if (viewingPO && pendingPODownload) {
      downloadElement(poDocRef.current, viewingPO.poNumber);
      setPendingPODownload(false);
    }
  }, [viewingPO, pendingPODownload]);

  function downloadPO(po: PurchaseOrderDTO) {
    setViewingPO(po);
    setPendingPODownload(true);
  }

  const setEditLine = (i: number, patch: Partial<Line>) =>
    setEditLines(prev => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const editTotal = editLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);

  function openEditPO(po: PurchaseOrderDTO) {
    setEditingPO(po);
    setEditSupplier(po.supplier);
    setEditExpectedDate(po.expectedDate ?? "");
    setEditLines(po.items.map(it => ({
      medicineName: it.medicineName, quantity: String(it.quantity), price: String(it.unitCost),
    })));
  }

  async function saveEditPO() {
    if (!editingPO) return;
    await runEdit(() => api.patch(`/pharmacy/purchase-orders/${editingPO.id}`, {
      supplier: editSupplier,
      expectedDate: editExpectedDate,
      items: editLines
        .filter(l => l.medicineName.trim() && Number(l.quantity) > 0)
        .map(l => ({ medicineName: l.medicineName, quantity: Number(l.quantity), unitCost: Number(l.price) || 0, pharmacyItemId: l.pharmacyItemId })),
    }));
    setEditingPO(null);
    reload();
  }

  async function createPO() {
    await run(() => api.post("/pharmacy/purchase-orders", {
      supplier, expectedDate,
      items: lines
        .filter(l => l.medicineName.trim() && Number(l.quantity) > 0)
        .map(l => ({
          medicineName: l.medicineName,
          quantity: Number(l.quantity),
          unitCost: Number(l.price) || 0,
          pharmacyItemId: l.pharmacyItemId,
        })),
    }));
    setSupplier(""); setExpectedDate("");
    setLines([{ medicineName: "", quantity: "", price: "" }]);
    reload();
  }

  async function receive(po: PurchaseOrderDTO) {
    const res = await api.post<PurchaseOrderDTO & { receipt?: { applied: { name: string; added: number }[]; unmatched: string[] } }>(
      `/pharmacy/purchase-orders/${po.id}/receive`);
    const r = res?.receipt;
    const parts: string[] = [];
    if (r?.applied?.length) parts.push(`Stock increased: ${r.applied.map(a => `${a.name} (+${a.added})`).join(", ")}.`);
    if (r?.unmatched?.length) parts.push(`Not in inventory: ${r.unmatched.join(", ")}.`);
    setNotice(parts.join(" ") || "Purchase order received.");
    reload(); onChanged();
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* View PO */}
      <Modal open={!!viewingPO} onClose={() => setViewingPO(null)} title={viewingPO ? `Purchase Order — ${viewingPO.poNumber}` : ""} width={700}
        footer={viewingPO && (
          <>
            <button onClick={() => downloadElement(poDocRef.current, viewingPO.poNumber)}
              className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">
              <Download size={14} /> Download
            </button>
            {viewingPO.status === "Pending" && (
              <button onClick={() => { openEditPO(viewingPO); setViewingPO(null); }}
                className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">
                <Pencil size={14} /> Edit
              </button>
            )}
          </>
        )}
      >
        {viewingPO && (
          <div ref={poDocRef} className="border border-[#dedee1] rounded-[12px] overflow-hidden">
            <DocumentLetterhead
              hospital={hospital}
              compact
              right={
                <>
                  <div className="text-[18px] font-medium text-[#11111c]">{viewingPO.poNumber}</div>
                  <div className="text-[12px] font-light text-[#57575f] mt-1">Order date: {formatDate(viewingPO.orderDate)}</div>
                  {viewingPO.expectedDate && <div className="text-[12px] font-light text-[#57575f]">Expected: {formatDate(viewingPO.expectedDate)}</div>}
                  <div className="mt-2"><StatusBadge status={viewingPO.status} /></div>
                </>
              }
            />
            <div className="px-8 py-6">
              <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-1">Supplier</p>
              <p className="text-[14px] font-medium text-[#11111c] mb-4">{viewingPO.supplier}</p>
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider" style={{ borderBottom: "1px solid #dedee1" }}>
                    <th className="text-left pb-2">#</th>
                    <th className="text-left pb-2">Medicine</th>
                    <th className="text-right pb-2">Qty</th>
                    <th className="text-right pb-2">Unit ₹</th>
                    <th className="text-right pb-2">Amount ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPO.items.map((it, i) => (
                    <tr key={it.id} className="text-[13px]" style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td className="py-2 text-[#57575f]">{i + 1}</td>
                      <td className="py-2 text-[#11111c]">{it.medicineName}</td>
                      <td className="py-2 text-right text-[#57575f]">{it.quantity}</td>
                      <td className="py-2 text-right text-[#57575f]">{it.unitCost.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-right text-[#11111c] font-medium">{(it.quantity * it.unitCost).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end mt-4">
                <div className="text-[15px] font-medium text-[#11111c]">Total: <span className="text-[#009598]">₹{viewingPO.total.toLocaleString("en-IN")}</span></div>
              </div>
            </div>
            <DocumentFooter hospital={hospital} />
          </div>
        )}
      </Modal>

      {/* Edit PO */}
      <Modal open={!!editingPO} onClose={() => setEditingPO(null)} title={editingPO ? `Edit — ${editingPO.poNumber}` : ""}
        footer={
          <>
            <button onClick={() => setEditingPO(null)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={saveEditPO} disabled={editLoading || !editSupplier}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {editLoading ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormRow label="Supplier *">
            <FormSelect placeholder="Select supplier" value={editSupplier} onChange={setEditSupplier}
              options={suppliers.map(x => ({ value: x, label: x }))} />
          </FormRow>
          <FormRow label="Expected Date">
            <FormInput type="date" value={editExpectedDate} onChange={setEditExpectedDate} />
          </FormRow>
        </div>
        <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Medicines</p>
        <div className="flex flex-col gap-2">
          {editLines.map((l, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "2fr 100px 120px 36px" }}>
              <MedicinePicker items={items} value={l.medicineName}
                onPick={(m, text) => setEditLine(i, { medicineName: text, pharmacyItemId: m?.id })} />
              <input value={l.quantity} type="number" placeholder="Qty"
                onChange={(e) => setEditLine(i, { quantity: e.target.value })}
                className="text-[14px] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white" />
              <input value={l.price} type="number" placeholder="Unit ₹"
                onChange={(e) => setEditLine(i, { price: e.target.value })}
                className="text-[14px] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white" />
              <button onClick={() => setEditLines(prev => prev.filter((_, n) => n !== i))}
                disabled={editLines.length === 1}
                className="text-[#c8c8cc] hover:text-[#ff0004] disabled:opacity-30 transition-colors">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => setEditLines(prev => [...prev, { medicineName: "", quantity: "", price: "" }])}
          className="mt-2 text-[12px] text-[#009598] hover:underline">+ Add medicine</button>
        {editError && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{editError.message}</div>}
        <div className="flex justify-end mt-4">
          <span className="text-[14px] font-medium text-[#11111c]">Total: <span className="text-[#009598]">₹{editTotal.toLocaleString("en-IN")}</span></span>
        </div>
      </Modal>

      <div className="border border-[#dedee1] rounded-[10px] p-5">
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">New Purchase Order</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormRow label="Supplier *">
            <FormSelect placeholder="Select supplier" value={supplier} onChange={setSupplier}
              options={suppliers.map(x => ({ value: x, label: x }))} />
          </FormRow>
          <FormRow label="Expected Date">
            <FormInput type="date" value={expectedDate} onChange={setExpectedDate} />
          </FormRow>
        </div>

        <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Medicines</p>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "2fr 100px 120px 36px" }}>
              <MedicinePicker items={items} value={l.medicineName}
                onPick={(m, text) => setLine(i, { medicineName: text, pharmacyItemId: m?.id })} />
              <input value={l.quantity} type="number" placeholder="Qty"
                onChange={(e) => setLine(i, { quantity: e.target.value })}
                className="text-[14px] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white" />
              <input value={l.price} type="number" placeholder="Unit ₹"
                onChange={(e) => setLine(i, { price: e.target.value })}
                className="text-[14px] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white" />
              <button onClick={() => setLines(prev => prev.filter((_, n) => n !== i))}
                disabled={lines.length === 1}
                className="text-[#c8c8cc] hover:text-[#ff0004] disabled:opacity-30 transition-colors">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => setLines(prev => [...prev, { medicineName: "", quantity: "", price: "" }])}
          className="mt-2 text-[12px] text-[#009598] hover:underline">+ Add medicine</button>

        {error && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}

        <div className="flex justify-between items-center mt-4">
          <span className="text-[14px] font-medium text-[#11111c]">
            Total: <span className="text-[#009598]">₹{total.toLocaleString("en-IN")}</span>
          </span>
          <button onClick={createPO} disabled={loading || !supplier}
            className="bg-[#009598] text-white text-[14px] font-normal px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
            {loading ? "Creating…" : "Create PO"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 text-[13px] text-[#11111c] bg-[#e8f7f7] border border-[#b8e5e6] rounded-[10px] px-4 py-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-[#57575f] shrink-0">✕</button>
        </div>
      )}

      <div>
        <h3 className="text-[14px] font-medium text-[#11111c] mb-3">Purchase Orders</h3>
        <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
          <div className="grid items-center px-4 h-10 bg-[#f2f3f3] text-[12px] font-medium text-[#11111c]"
            style={{ gridTemplateColumns: "110px 1.4fr 110px 70px 110px 110px 150px" }}>
            <span>PO Number</span><span>Supplier</span><span>Date</span><span>Items</span>
            <span>Total</span><span>Status</span><span>Action</span>
          </div>
          {orders.length === 0 && (
            <div className="py-10 text-center text-[13px] text-[#57575f]">No purchase orders yet.</div>
          )}
          {orders.map(po => (
            <div key={po.id} className="grid items-center px-4 h-[56px] border-b border-[#f0f0f0] last:border-0 bg-white hover:bg-[#fafafa] transition-colors"
              style={{ gridTemplateColumns: "110px 1.4fr 110px 70px 110px 110px 150px" }}>
              <span className="text-[13px] font-medium text-[#009598]">{po.poNumber}</span>
              <span className="text-[13px] text-[#11111c] truncate">{po.supplier}</span>
              <span className="text-[13px] text-[#57575f]">{formatDate(po.orderDate)}</span>
              <span className="text-[13px] text-[#57575f]">{po.itemCount}</span>
              <span className="text-[13px] font-medium text-[#11111c]">₹{po.total.toLocaleString("en-IN")}</span>
              <span className={`inline-flex w-fit items-center px-[10px] py-[4px] rounded-full text-[11px] ${PO_STATUS[po.status] ?? ""}`}>{po.status}</span>
              <div className="flex items-center gap-2 justify-end">
                {po.status === "Pending" && (
                  <button onClick={() => void receive(po)}
                    className="text-[12px] text-white bg-[#009598] px-3 py-[5px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap">
                    Receive stock
                  </button>
                )}
                <RowMenu actions={[
                  { label: "View", onClick: () => setViewingPO(po) },
                  { label: "Edit", disabled: po.status !== "Pending", onClick: () => openEditPO(po) },
                  { label: "Download bill", onClick: () => downloadPO(po) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────

const MODE_CLR: Record<string, string> = {
  UPI: "bg-[#d6eaff] text-[#007cff]", Cash: "bg-[#dffff3] text-[#00955c]",
  Card: "bg-[#fff2e0] text-[#ff9000]", Cheque: "bg-[#f0f0f0] text-[#57575f]",
  Insurance: "bg-[#ede9ff] text-[#6b4eff]",
};

type DiscountType = "flat" | "percent";

function SalesView({ items, onChanged }: { items: PharmacyItemDTO[]; onChanged: () => void }) {
  const { items: sales, reload } = useList<PharmacySaleDTO>("/pharmacy/sales", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: prescriptions } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { run, loading, error } = useMutation();
  const hospital = useHospital();
  const saleDocRef = useRef<HTMLDivElement>(null);

  // View / Edit / Download dialogs
  const [viewingSale, setViewingSale] = useState<PharmacySaleDTO | null>(null);
  const [pendingDownload, setPendingDownload] = useState(false);
  const [editingSale, setEditingSale] = useState<PharmacySaleDTO | null>(null);
  const [editRx, setEditRx] = useState("");
  const [editMode, setEditMode] = useState("Cash");
  const [editDiscount, setEditDiscount] = useState("");
  const { run: runEditSale, loading: editSaleLoading, error: editSaleError } = useMutation();

  useEffect(() => {
    if (viewingSale && pendingDownload) {
      downloadElement(saleDocRef.current, viewingSale.saleNumber);
      setPendingDownload(false);
    }
  }, [viewingSale, pendingDownload]);

  function downloadSale(s: PharmacySaleDTO) {
    setViewingSale(s);
    setPendingDownload(true);
  }

  function openEditSale(s: PharmacySaleDTO) {
    setEditingSale(s);
    setEditRx(s.rxNumber ?? "");
    setEditMode(s.paymentMode);
    setEditDiscount(String(s.discount ?? 0));
  }

  const editSaleTotal = editingSale ? Math.max(0, editingSale.subtotal - (Number(editDiscount) || 0)) : 0;

  async function saveEditSale() {
    if (!editingSale) return;
    await runEditSale(() => api.patch(`/pharmacy/sales/${editingSale.id}`, {
      rxNumber: editRx, paymentMode: editMode, discount: Number(editDiscount) || 0,
    }));
    setEditingSale(null);
    reload();
  }

  const [patientId, setPatientId] = useState("");
  const [rxNumber, setRxNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("flat");
  const [lines, setLines] = useState<Line[]>([{ medicineName: "", quantity: "", price: "" }]);

  // This patient's prescriptions, latest first.
  const patientRx = useMemo(() => {
    if (!patientId) return [];
    return prescriptions
      .filter(rx => String(rx.patientId) === patientId)
      .sort((a, b) => (parseDisplayDate(b.date)?.getTime() ?? 0) - (parseDisplayDate(a.date)?.getTime() ?? 0));
  }, [prescriptions, patientId]);

  // Selecting a patient defaults the field to their most recent prescription.
  useEffect(() => {
    setRxNumber(patientRx[0]?.rxNumber ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Selecting a prescription fetches its medicines and fills the line items —
  // matched against real stock where possible, so the pharmacist can drop or
  // adjust any that are out of stock before billing rather than retyping the Rx.
  useEffect(() => {
    if (!rxNumber) return;
    const rx = patientRx.find(r => r.rxNumber === rxNumber);
    if (!rx) return;
    let cancelled = false;
    api.get<PrescriptionDTO>(`/prescriptions/${rx.id}`).then(full => {
      if (cancelled || full.items.length === 0) return;
      setLines(full.items.map(item => {
        const stockMatch = findStockMatch(items, item.medicineName);
        return {
          medicineName: item.medicineName,
          quantity: String(unitsFor(item.frequency, item.duration)),
          price: "",
          pharmacyItemId: stockMatch?.id,
        };
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxNumber]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);
  const discountAmount = discountType === "percent"
    ? subtotal * (Math.min(100, Math.max(0, Number(discount) || 0)) / 100)
    : Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountAmount);

  async function generateBill() {
    await run(() => api.post("/pharmacy/sales", {
      patientId: patientId ? Number(patientId) : undefined,
      patientName: patientId ? undefined : "Walk-in",
      rxNumber, paymentMode,
      discount: Math.round(discountAmount),
      items: lines
        .filter(l => l.medicineName.trim() && Number(l.quantity) > 0)
        .map(l => ({
          medicineName: l.medicineName,
          quantity: Number(l.quantity),
          unitPrice: Number(l.price) || 0,
          pharmacyItemId: l.pharmacyItemId,
        })),
    }));
    setPatientId(""); setRxNumber(""); setDiscount(""); setDiscountType("flat");
    setLines([{ medicineName: "", quantity: "", price: "" }]);
    reload(); onChanged();
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* View / Download bill */}
      <Modal open={!!viewingSale} onClose={() => setViewingSale(null)} title={viewingSale ? `Bill — ${viewingSale.saleNumber}` : ""} width={700}
        footer={viewingSale && (
          <>
            <button onClick={() => downloadElement(saleDocRef.current, viewingSale.saleNumber)}
              className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">
              <Download size={14} /> Download
            </button>
            <button onClick={() => { openEditSale(viewingSale); setViewingSale(null); }}
              className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">
              <Pencil size={14} /> Edit
            </button>
          </>
        )}
      >
        {viewingSale && (
          <div ref={saleDocRef} className="border border-[#dedee1] rounded-[12px] overflow-hidden">
            <DocumentLetterhead
              hospital={hospital}
              compact
              right={
                <>
                  <div className="text-[18px] font-medium text-[#11111c]">{viewingSale.saleNumber}</div>
                  <div className="text-[12px] font-light text-[#57575f] mt-1">Date: {formatDate(viewingSale.date)}</div>
                </>
              }
            />
            <div className="grid grid-cols-2 gap-6 px-8 py-5" style={{ borderBottom: "1px solid #dedee1" }}>
              <div>
                <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-1">Patient</p>
                <p className="text-[14px] font-medium text-[#11111c]">{viewingSale.patientName}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-1">Payment</p>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-[#57575f]">Mode</span>
                  <span className="text-[#11111c] font-medium">{viewingSale.paymentMode}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#57575f]">Prescription</span>
                  <span className="text-[#11111c]">{viewingSale.rxNumber || "—"}</span>
                </div>
              </div>
            </div>
            <div className="px-8 py-6">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider" style={{ borderBottom: "1px solid #dedee1" }}>
                    <th className="text-left pb-2">#</th>
                    <th className="text-left pb-2">Medicine</th>
                    <th className="text-right pb-2">Qty</th>
                    <th className="text-right pb-2">Unit ₹</th>
                    <th className="text-right pb-2">Amount ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingSale.items.map((it, i) => (
                    <tr key={it.id} className="text-[13px]" style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td className="py-2 text-[#57575f]">{i + 1}</td>
                      <td className="py-2 text-[#11111c]">{it.medicineName}</td>
                      <td className="py-2 text-right text-[#57575f]">{it.quantity}</td>
                      <td className="py-2 text-right text-[#57575f]">{it.unitPrice.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-right text-[#11111c] font-medium">{it.lineTotal.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end mt-4">
                <div className="w-56 flex flex-col gap-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#57575f]">Subtotal</span>
                    <span className="text-[#11111c]">₹{viewingSale.subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {viewingSale.discount > 0 && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#57575f]">Discount</span>
                      <span className="text-[#00955c]">− ₹{viewingSale.discount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="h-px bg-[#dedee1] my-1" />
                  <div className="flex justify-between text-[15px] font-medium">
                    <span className="text-[#11111c]">Total</span>
                    <span className="text-[#009598]">₹{viewingSale.total.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
            <DocumentFooter hospital={hospital} />
          </div>
        )}
      </Modal>

      {/* Edit bill */}
      <Modal open={!!editingSale} onClose={() => setEditingSale(null)} title={editingSale ? `Edit — ${editingSale.saleNumber}` : ""}
        footer={
          <>
            <button onClick={() => setEditingSale(null)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={saveEditSale} disabled={editSaleLoading}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {editSaleLoading ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <p className="text-[12px] font-light text-[#57575f] mb-4">
          Medicines and quantities can&apos;t be changed here since stock was already deducted for this sale — only billing details.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Prescription #">
            <FormInput placeholder="RX-… (optional)" value={editRx} onChange={setEditRx} />
          </FormRow>
          <FormRow label="Payment Mode">
            <FormSelect value={editMode} onChange={setEditMode}
              options={["Cash","UPI","Card","Cheque","Insurance"].map(m => ({ value: m, label: m }))} />
          </FormRow>
          <FormRow label="Discount ₹">
            <FormInput type="number" placeholder="0" value={editDiscount} onChange={setEditDiscount} />
          </FormRow>
        </div>
        {editSaleError && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{editSaleError.message}</div>}
        {editingSale && (
          <div className="flex justify-end mt-4">
            <span className="text-[14px] font-medium text-[#11111c]">
              New Total: <span className="text-[#009598]">₹{editSaleTotal.toLocaleString("en-IN")}</span>
            </span>
          </div>
        )}
      </Modal>

      <div className="border border-[#dedee1] rounded-[10px] p-5">
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Quick Billing</h3>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <FormRow label="Patient">
            <SearchSelect
              placeholder="Walk-in — search patient by name, ID or phone…"
              value={patientId}
              onChange={setPatientId}
              options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
            />
          </FormRow>
          <FormRow label="Prescription #">
            <FormSelect
              placeholder={!patientId ? "Select a patient first" : patientRx.length === 0 ? "No prescriptions for this patient" : undefined}
              value={rxNumber}
              onChange={setRxNumber}
              options={[
                ...(patientRx.length > 0 ? [{ value: "", label: "No prescription" }] : []),
                ...patientRx.map(rx => ({ value: rx.rxNumber, label: `${rx.rxNumber} — ${rx.date}` })),
              ]}
            />
          </FormRow>
          <FormRow label="Payment Mode">
            <FormSelect value={paymentMode} onChange={setPaymentMode}
              options={["Cash","UPI","Card","Cheque","Insurance"].map(m => ({ value: m, label: m }))} />
          </FormRow>
          <FormRow label="Discount">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#f6f6f6] rounded-[8px] p-[3px] shrink-0">
                {([{ id: "flat", label: "₹" }, { id: "percent", label: "%" }] as const).map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDiscountType(o.id)}
                    className={`w-7 h-7 rounded-[6px] text-[13px] font-medium transition-colors ${
                      discountType === o.id ? "bg-[#009598] text-white" : "text-[#57575f] hover:text-[#11111c]"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <FormInput
                type="number"
                placeholder="0"
                value={discount}
                onChange={setDiscount}
                max={discountType === "percent" ? "100" : undefined}
              />
            </div>
          </FormRow>
        </div>

        <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">
          Medicines <span className="font-normal normal-case">— scan or search; add as many as needed</span>
        </p>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const stockMatch = l.pharmacyItemId ? items.find(x => x.id === l.pharmacyItemId) : undefined;
            const notFound = l.medicineName.trim() && !stockMatch;
            const outOfStock = stockMatch && stockMatch.stock <= 0;
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 100px 120px 36px" }}>
                  <MedicinePicker items={items} value={l.medicineName}
                    placeholder="Scan barcode or search medicine"
                    onPick={(m, text) => setLine(i, { medicineName: text, pharmacyItemId: m?.id })} />
                  <input value={l.quantity} type="number" placeholder="Qty"
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    className="text-[14px] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white" />
                  <input value={l.price} type="number" placeholder="Unit ₹"
                    onChange={(e) => setLine(i, { price: e.target.value })}
                    className="text-[14px] bg-[#f6f6f6] border border-transparent rounded-[10px] px-3 py-[10px] outline-none focus:border-[#009598] focus:bg-white" />
                  <button onClick={() => setLines(prev => prev.filter((_, n) => n !== i))}
                    disabled={lines.length === 1}
                    className="text-[#c8c8cc] hover:text-[#ff0004] disabled:opacity-30 transition-colors">✕</button>
                </div>
                {(notFound || outOfStock) && (
                  <p className="text-[11px] font-normal text-[#ff0004] pl-1">
                    {notFound ? "Not found in pharmacy inventory — remove or pick the matching item." : "Out of stock — remove this line or wait for restock."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={() => setLines(prev => [...prev, { medicineName: "", quantity: "", price: "" }])}
          className="mt-2 text-[12px] text-[#009598] hover:underline">+ Add medicine</button>

        {error && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}

        <div className="flex justify-between items-center mt-4">
          <span className="text-[14px] font-medium text-[#11111c]">
            Total: <span className="text-[#009598]">₹{total.toLocaleString("en-IN")}</span>
            {discountAmount > 0 && (
              <span className="text-[12px] font-light text-[#57575f]">
                {" "}(after {discountType === "percent" ? `${discount}%` : `₹${Number(discount).toLocaleString("en-IN")}`} discount — ₹{Math.round(discountAmount).toLocaleString("en-IN")} off)
              </span>
            )}
          </span>
          <button onClick={generateBill} disabled={loading || subtotal <= 0}
            className="bg-[#009598] text-white text-[14px] font-normal px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
            {loading ? "Billing…" : "Generate Bill"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-[14px] font-medium text-[#11111c] mb-3">Recent Sales</h3>
        <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
          <div className="grid items-center px-4 h-10 bg-[#f2f3f3] text-[12px] font-medium text-[#11111c]"
            style={{ gridTemplateColumns: "110px 1.4fr 120px 70px 110px 110px 52px" }}>
            <span>Sale #</span><span>Patient</span><span>Rx</span><span>Items</span><span>Total</span><span>Mode</span><span className="text-right">Action</span>
          </div>
          {sales.length === 0 && (
            <div className="py-10 text-center text-[13px] text-[#57575f]">No sales recorded yet.</div>
          )}
          {sales.map(s => (
            <div key={s.id} className="grid items-center px-4 h-[52px] border-b border-[#f0f0f0] last:border-0 bg-white hover:bg-[#fafafa] transition-colors"
              style={{ gridTemplateColumns: "110px 1.4fr 120px 70px 110px 110px 52px" }}>
              <span className="text-[13px] font-medium text-[#009598]">{s.saleNumber}</span>
              <span className="text-[13px] text-[#11111c] truncate">{s.patientName}</span>
              <span className="text-[13px] text-[#57575f]">{s.rxNumber || "—"}</span>
              <span className="text-[13px] text-[#57575f]">{s.itemCount}</span>
              <span className="text-[13px] font-medium text-[#11111c]">₹{s.total.toLocaleString("en-IN")}</span>
              <span className={`inline-flex w-fit items-center px-[10px] py-[4px] rounded-full text-[11px] ${MODE_CLR[s.paymentMode] ?? ""}`}>{s.paymentMode}</span>
              <div className="flex justify-end">
                <RowMenu actions={[
                  { label: "View", onClick: () => setViewingSale(s) },
                  { label: "Edit", onClick: () => openEditSale(s) },
                  { label: "Download bill", onClick: () => downloadSale(s) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

// ─── Expiring Soon ────────────────────────────────────────────────────────────

const EXPIRY_WINDOWS = [
  { id: "1w", label: "Within 1 week",   days: 7 },
  { id: "1m", label: "Within 1 month",  days: 30 },
  { id: "3m", label: "Within 3 months", days: 92 },
  { id: "6m", label: "Within 6 months", days: 183 },
] as const;

interface ReorderTarget {
  id: number;
  name: string;
  stock: number;
}

function ExpiringView({ pharmacyItems, onReorder, onRemove }: { pharmacyItems: PharmacyItemDTO[]; onReorder: (item: ReorderTarget) => void; onRemove: (id: number, name: string) => void }) {
  const [windowId, setWindowId] = useState<(typeof EXPIRY_WINDOWS)[number]["id"]>("3m");
  const win = EXPIRY_WINDOWS.find(w => w.id === windowId)!;
  const cutoff = new Date(Date.now() + win.days * 24 * 60 * 60 * 1000);
  const now = new Date();

  const rows = pharmacyItems
    .map(i => ({ item: i, expiry: parseMonthYear(i.expiryDate) }))
    .filter((r): r is { item: PharmacyItemDTO; expiry: Date } => r.expiry !== null && r.expiry <= cutoff)
    .sort((a, b) => a.expiry.getTime() - b.expiry.getTime());

  return (
    <div className="p-5 flex flex-col gap-4" style={{ minHeight: 300 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[#ff9000]" />
          <span className="text-[14px] font-medium text-[#11111c]">About to Expire</span>
          <span className="text-[11px] px-[8px] py-[2px] rounded-full font-medium bg-[#fff2e0] text-[#ff9000]">{rows.length}</span>
        </div>
        <select
          value={windowId}
          onChange={e => setWindowId(e.target.value as (typeof EXPIRY_WINDOWS)[number]["id"])}
          className="h-[36px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
        >
          {EXPIRY_WINDOWS.map(w => (
            <option key={w.id} value={w.id}>{w.label}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-[14px] font-normal text-[#57575f]">Nothing expiring {win.label.toLowerCase()}.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ item, expiry }) => {
            const expired = expiry < now;
            const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            return (
              <div key={item.id} className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px] bg-white">
                <div className="flex flex-col gap-[3px] min-w-0">
                  <span className="text-[14px] font-medium text-[#11111c] truncate">{item.name}</span>
                  <span className="text-[12px] font-light text-[#57575f] truncate">{item.category} · {item.supplier} · {item.stock} units in stock</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={`text-[13px] font-normal ${expired ? "text-[#ff0004]" : daysLeft <= 30 ? "text-[#ff9000]" : "text-[#57575f]"}`}>
                    {expired ? `Expired ${item.expiryDate}` : `Expires ${item.expiryDate} · ${daysLeft} days`}
                  </span>
                  <button
                    onClick={() => (expired ? onRemove(item.id, item.name) : onReorder(item))}
                    className="text-[12px] font-medium text-white bg-[#009598] px-4 py-[6px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap"
                  >
                    {expired ? "Remove" : "Reorder"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertsView({ pharmacyItems, onReorder, onRemove }: { pharmacyItems: PharmacyItemDTO[]; onReorder: (item: ReorderTarget) => void; onRemove: (id: number, name: string) => void }) {
  const lowStock  = pharmacyItems.filter(i => i.status === "Low Stock");
  const outStock  = pharmacyItems.filter(i => i.status === "Out of Stock");
  const expired   = pharmacyItems.filter(i => i.status === "Expired");

  const AlertCard = ({ item, type }: { item: PharmacyItem; type: string }) => (
    <div className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px] bg-white">
      <div className="flex flex-col gap-[4px]">
        <span className="text-[14px] font-medium text-[#11111c]">{item.name}</span>
        <span className="text-[12px] font-light text-[#57575f]">{item.category} · {item.supplier}</span>
      </div>
      <div className="flex items-center gap-4">
        {type === "low"    && <span className="text-[13px] font-normal text-[#ff9000]">Stock: {item.stock} / Min: {item.minStock}</span>}
        {type === "out"    && <span className="text-[13px] font-normal text-[#ff0004]">Out of stock</span>}
        {type === "expiry" && <span className="text-[13px] font-normal text-[#ff0004]">Expired: {item.expiryDate}</span>}
        <button
          onClick={() => (type === "expiry" ? onRemove(item.id, item.name) : onReorder(item))}
          className="text-[12px] font-medium text-white bg-[#009598] px-4 py-[6px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap">
          {type === "expiry" ? "Remove" : "Reorder"}
        </button>
      </div>
    </div>
  );

  const Section = ({ icon: Icon, title, color, items, type }: { icon: any; title: string; color: string; items: PharmacyItem[]; type: string }) => (
    items.length > 0 ? (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={color} />
          <span className={`text-[14px] font-medium ${color}`}>{title}</span>
          <span className={`text-[11px] px-[6px] py-[2px] rounded-full font-medium ${color.includes("ff9000") ? "bg-[#fff2e0]" : color.includes("ff0004") ? "bg-[#ffe9e9]" : "bg-[#d6eaff]"} ${color}`}>{items.length}</span>
        </div>
        {items.map(item => <AlertCard key={item.id} item={item} type={type} />)}
      </div>
    ) : null
  );

  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 555 }}>
      {lowStock.length === 0 && outStock.length === 0 && expired.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-[14px] font-normal text-[#57575f]">No active alerts — inventory is healthy.</span>
        </div>
      ) : (
        <>
          <Section icon={TrendingDown} title="Low Stock" color="text-[#ff9000]" items={lowStock} type="low" />
          <Section icon={XCircle}     title="Out of Stock" color="text-[#ff0004]" items={outStock} type="out" />
          <Section icon={Clock}       title="Expired" color="text-[#ff0004]" items={expired} type="expiry" />
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PHARMA_FILTER_MAP: Record<string, string> = { "InStock": "In Stock", "LowStock": "Low Stock", "OutOfStock": "Out of Stock" };

export default function PharmacyPage() {
  const [tab, setTab] = useState("inventory");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { items: pharmacyItems, reload } = useList<PharmacyItemDTO>("/pharmacy", { all: true });
  const { run, loading, error } = useMutation();
  const { dialog, remove } = useRowActions("pharmacy", reload);

  const [form, setForm] = useState({ name: "", category: "", stock: "", minStock: "", expiryDate: "", supplier: "" });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Reorder dialog — lets the user pick how many units to add, rather than a fixed +100.
  const [reorderTarget, setReorderTarget] = useState<ReorderTarget | null>(null);
  const [reorderQty, setReorderQty] = useState("100");
  const { run: runReorder, loading: reorderLoading, error: reorderError } = useMutation();

  function openReorder(item: ReorderTarget) {
    setReorderTarget(item);
    setReorderQty("100");
  }

  function closeReorder() {
    setReorderTarget(null);
    setReorderQty("100");
  }

  async function submitReorder() {
    if (!reorderTarget) return;
    await runReorder(() =>
      api.post(`/pharmacy/${reorderTarget.id}/restock`, { quantity: Number(reorderQty) }),
    );
    closeReorder();
    reload();
  }

  async function addItem() {
    await run(() =>
      api.post("/pharmacy", {
        name: form.name,
        category: form.category,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        expiryDate: form.expiryDate,
        supplier: form.supplier,
      }),
    );
    setForm({ name: "", category: "", stock: "", minStock: "", expiryDate: "", supplier: "" });
    setShowModal(false);
    reload();
  }

  const TABS = [
    { id: "inventory", label: "Inventory",   count: pharmacyItems.length },
    { id: "purchase",  label: "Purchase" },
    { id: "sales",     label: "Sales" },
    { id: "expiring",  label: "About to Expire" },
    { id: "alerts",    label: "Alerts", count: pharmacyItems.filter(i => ["Low Stock","Out of Stock","Expired"].includes(i.status)).length },
  ];

  const visible = pharmacyItems.filter(i => {
    const matchF = filter === "All" || i.status === (PHARMA_FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Pharmacy Item"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={addItem} disabled={loading || !form.name || form.stock === ""}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Adding…" : "Add Item"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormRow label="Medicine Name *"><FormInput placeholder="e.g. Paracetamol 500mg" value={form.name} onChange={v => set("name", v)} /></FormRow></div>
          <FormRow label="Category"><FormInput placeholder="e.g. Analgesic" value={form.category} onChange={v => set("category", v)} /></FormRow>
          <FormRow label="Supplier"><FormInput placeholder="Supplier name" value={form.supplier} onChange={v => set("supplier", v)} /></FormRow>
          <FormRow label="Stock *"><FormInput type="number" placeholder="0" value={form.stock} onChange={v => set("stock", v)} /></FormRow>
          <FormRow label="Min Stock"><FormInput type="number" placeholder="0" value={form.minStock} onChange={v => set("minStock", v)} /></FormRow>
          <div className="col-span-2"><FormRow label="Expiry Date"><FormInput placeholder="e.g. Mar 2027" value={form.expiryDate} onChange={v => set("expiryDate", v)} /></FormRow></div>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      <Modal open={!!reorderTarget} onClose={closeReorder} title={`Reorder — ${reorderTarget?.name ?? ""}`}
        footer={
          <>
            <button onClick={closeReorder} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={submitReorder} disabled={reorderLoading || !reorderQty || Number(reorderQty) <= 0}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {reorderLoading ? "Saving…" : "Confirm Reorder"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormRow label="Quantity to Add *">
            <FormInput type="number" placeholder="e.g. 100" value={reorderQty} onChange={setReorderQty} />
          </FormRow>
          {reorderTarget && Number(reorderQty) > 0 && (
            <p className="text-[12px] font-light text-[#57575f]">
              Current stock: {reorderTarget.stock} units → new stock: {reorderTarget.stock + Number(reorderQty)} units
            </p>
          )}
          {reorderError && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{reorderError.message}</div>}
        </div>
      </Modal>

      <PageHeader
        title="Pharmacy"
        subtitle="Manage drug inventory, purchase orders, billing, and stock alerts."
        stats={[{ icon: Pill, value: `${visible.length}`, label: "Total Items" }]}
        action={{ label: "Add Item", icon: Plus, onClick: () => setShowModal(true) }}
        dateRange={false}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "inventory" && (
            <>
              <FilterBar filters={INV_FILTERS} searchPlaceholder="Search by medicine name, category, or supplier..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={INV_COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No items found.</div>
                ) : visible.map(r => (
                  <InventoryRow key={r.id} row={r} actions={[
                    { label: "Reorder", onClick: () => openReorder(r) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.name) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "purchase" && <PurchaseView items={pharmacyItems} onChanged={reload} />}
          {tab === "sales"    && <SalesView items={pharmacyItems} onChanged={reload} />}
          {tab === "expiring" && <ExpiringView pharmacyItems={pharmacyItems} onReorder={openReorder} onRemove={remove} />}
          {tab === "alerts"   && <AlertsView pharmacyItems={pharmacyItems} onReorder={openReorder} onRemove={remove} />}
        </div>
      </div>
    </>
  );
}
