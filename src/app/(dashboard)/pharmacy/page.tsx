"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { Pill, Plus, MoreVertical, AlertTriangle, Clock, XCircle, TrendingDown } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { parseMonthYear, formatDate } from "@/lib/dates";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { PharmacyItemDTO, PurchaseOrderDTO, PharmacySaleDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
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

  const [supplier, setSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<Line[]>([{ medicineName: "", quantity: "", price: "" }]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);

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
              <div>
                {po.status === "Pending" ? (
                  <button onClick={() => void receive(po)}
                    className="text-[12px] text-white bg-[#009598] px-3 py-[5px] rounded-full hover:bg-[#007f82] transition-colors">
                    Receive stock
                  </button>
                ) : <span className="text-[12px] text-[#57575f]">—</span>}
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

function SalesView({ items, onChanged }: { items: PharmacyItemDTO[]; onChanged: () => void }) {
  const { items: sales, reload } = useList<PharmacySaleDTO>("/pharmacy/sales", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading, error } = useMutation();

  const [patientId, setPatientId] = useState("");
  const [rxNumber, setRxNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discount, setDiscount] = useState("");
  const [lines, setLines] = useState<Line[]>([{ medicineName: "", quantity: "", price: "" }]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  async function generateBill() {
    await run(() => api.post("/pharmacy/sales", {
      patientId: patientId ? Number(patientId) : undefined,
      patientName: patientId ? undefined : "Walk-in",
      rxNumber, paymentMode,
      discount: Number(discount) || 0,
      items: lines
        .filter(l => l.medicineName.trim() && Number(l.quantity) > 0)
        .map(l => ({
          medicineName: l.medicineName,
          quantity: Number(l.quantity),
          unitPrice: Number(l.price) || 0,
          pharmacyItemId: l.pharmacyItemId,
        })),
    }));
    setPatientId(""); setRxNumber(""); setDiscount("");
    setLines([{ medicineName: "", quantity: "", price: "" }]);
    reload(); onChanged();
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="border border-[#dedee1] rounded-[10px] p-5">
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Quick Billing</h3>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <FormRow label="Patient">
            <FormSelect placeholder="Walk-in" value={patientId} onChange={setPatientId}
              options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} />
          </FormRow>
          <FormRow label="Prescription #">
            <FormInput placeholder="RX-… (optional)" value={rxNumber} onChange={setRxNumber} />
          </FormRow>
          <FormRow label="Payment Mode">
            <FormSelect value={paymentMode} onChange={setPaymentMode}
              options={["Cash","UPI","Card","Cheque","Insurance"].map(m => ({ value: m, label: m }))} />
          </FormRow>
          <FormRow label="Discount ₹">
            <FormInput type="number" placeholder="0" value={discount} onChange={setDiscount} />
          </FormRow>
        </div>

        <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">
          Medicines <span className="font-normal normal-case">— scan or search; add as many as needed</span>
        </p>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "2fr 100px 120px 36px" }}>
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
          ))}
        </div>
        <button onClick={() => setLines(prev => [...prev, { medicineName: "", quantity: "", price: "" }])}
          className="mt-2 text-[12px] text-[#009598] hover:underline">+ Add medicine</button>

        {error && <div className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}

        <div className="flex justify-between items-center mt-4">
          <span className="text-[14px] font-medium text-[#11111c]">
            Total: <span className="text-[#009598]">₹{total.toLocaleString("en-IN")}</span>
            {Number(discount) > 0 && <span className="text-[12px] font-light text-[#57575f]"> (after ₹{Number(discount).toLocaleString("en-IN")} discount)</span>}
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
            style={{ gridTemplateColumns: "110px 1.4fr 120px 70px 110px 110px" }}>
            <span>Sale #</span><span>Patient</span><span>Rx</span><span>Items</span><span>Total</span><span>Mode</span>
          </div>
          {sales.length === 0 && (
            <div className="py-10 text-center text-[13px] text-[#57575f]">No sales recorded yet.</div>
          )}
          {sales.map(s => (
            <div key={s.id} className="grid items-center px-4 h-[52px] border-b border-[#f0f0f0] last:border-0 bg-white hover:bg-[#fafafa] transition-colors"
              style={{ gridTemplateColumns: "110px 1.4fr 120px 70px 110px 110px" }}>
              <span className="text-[13px] font-medium text-[#009598]">{s.saleNumber}</span>
              <span className="text-[13px] text-[#11111c] truncate">{s.patientName}</span>
              <span className="text-[13px] text-[#57575f]">{s.rxNumber || "—"}</span>
              <span className="text-[13px] text-[#57575f]">{s.itemCount}</span>
              <span className="text-[13px] font-medium text-[#11111c]">₹{s.total.toLocaleString("en-IN")}</span>
              <span className={`inline-flex w-fit items-center px-[10px] py-[4px] rounded-full text-[11px] ${MODE_CLR[s.paymentMode] ?? ""}`}>{s.paymentMode}</span>
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

function ExpiringView({ pharmacyItems, onReorder, onRemove }: { pharmacyItems: PharmacyItemDTO[]; onReorder: (id: number) => void; onRemove: (id: number, name: string) => void }) {
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
                    onClick={() => (expired ? onRemove(item.id, item.name) : onReorder(item.id))}
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

function AlertsView({ pharmacyItems, onReorder, onRemove }: { pharmacyItems: PharmacyItemDTO[]; onReorder: (id: number) => void; onRemove: (id: number, name: string) => void }) {
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
          onClick={() => (type === "expiry" ? onRemove(item.id, item.name) : onReorder(item.id))}
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
  const { dialog, remove, mutate } = useRowActions("pharmacy", reload);
  const reorder = (id: number) => mutate(() => api.post(`/pharmacy/${id}/restock`, { quantity: 100 }));

  const [form, setForm] = useState({ name: "", category: "", stock: "", minStock: "", expiryDate: "", supplier: "" });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

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
                    { label: "Reorder +100", onClick: () => reorder(r.id) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.name) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "purchase" && <PurchaseView items={pharmacyItems} onChanged={reload} />}
          {tab === "sales"    && <SalesView items={pharmacyItems} onChanged={reload} />}
          {tab === "expiring" && <ExpiringView pharmacyItems={pharmacyItems} onReorder={reorder} onRemove={remove} />}
          {tab === "alerts"   && <AlertsView pharmacyItems={pharmacyItems} onReorder={reorder} onRemove={remove} />}
        </div>
      </div>
    </>
  );
}
