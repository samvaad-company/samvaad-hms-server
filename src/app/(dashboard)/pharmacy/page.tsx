"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { Pill, Plus, MoreVertical, AlertTriangle, Clock, XCircle, TrendingDown } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { parseMonthYear } from "@/lib/dates";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { PharmacyItemDTO } from "@/types/api";
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

const PURCHASE_ORDERS = [
  { id: "PO-2025-001", supplier: "MedPharma Ltd.",    date: "1 Nov 2025",  items: 8,  total: 45200, status: "Delivered" },
  { id: "PO-2025-002", supplier: "HealthPlus Corp.",   date: "5 Nov 2025",  items: 5,  total: 23800, status: "Pending"   },
  { id: "PO-2025-003", supplier: "Pharma India Pvt.", date: "8 Nov 2025",  items: 12, total: 67400, status: "Delivered" },
  { id: "PO-2025-004", supplier: "BioWell Pharma",    date: "10 Nov 2025", items: 3,  total: 12600, status: "In Transit" },
  { id: "PO-2025-005", supplier: "MedPharma Ltd.",    date: "12 Nov 2025", items: 6,  total: 31500, status: "Pending"   },
];

const PO_STATUS: Record<string, string> = {
  Delivered:   "bg-[#dffff3] text-[#00955c]",
  Pending:     "bg-[#fff2e0] text-[#ff9000]",
  "In Transit":"bg-[#d6eaff] text-[#007cff]",
};

function PurchaseView() {
  return (
    <div className="p-5 flex flex-col gap-5">
      {/* New PO quick form */}
      <div className="border border-[#dedee1] rounded-[10px] p-5">
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">New Purchase Order</h3>
        <div className="grid grid-cols-4 gap-4">
          <FormRow label="Supplier"><FormInput placeholder="Select supplier" /></FormRow>
          <FormRow label="Medicine"><FormInput placeholder="Search medicine" /></FormRow>
          <FormRow label="Quantity"><FormInput placeholder="Units" type="number" /></FormRow>
          <FormRow label="Expected Date"><FormInput type="date" /></FormRow>
        </div>
        <div className="flex justify-end mt-4">
          <button className="bg-[#009598] text-white text-[14px] font-normal px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">
            Create PO
          </button>
        </div>
      </div>

      {/* Purchase orders table */}
      <div>
        <h3 className="text-[14px] font-medium text-[#11111c] mb-3">Purchase Orders</h3>
        <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
          <div className="relative h-10 bg-[#f2f3f3]">
            {[{ l: "PO Number", x: 20 }, { l: "Supplier", x: 160 }, { l: "Date", x: 390 }, { l: "Items", x: 560 }, { l: "Total", x: 680 }, { l: "Status", x: 840 }, { l: "Action", x: 1030 }].map(c => (
              <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
            ))}
          </div>
          {PURCHASE_ORDERS.map(po => (
            <div key={po.id} className="relative flex items-center h-[56px] border-b border-[#dedee1] last:border-0 bg-white hover:bg-[#fafafa] transition-colors">
              <span className="absolute text-[14px] font-medium text-[#009598]" style={{ left: 20 }}>{po.id}</span>
              <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 160 }}>{po.supplier}</span>
              <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 390 }}>{po.date}</span>
              <span className="absolute text-[14px] font-normal text-[#11111c]" style={{ left: 560 }}>{po.items} items</span>
              <span className="absolute text-[14px] font-medium text-[#11111c]" style={{ left: 680 }}>₹{po.total.toLocaleString("en-IN")}</span>
              <span className={`absolute inline-flex items-center px-[10px] py-[5px] rounded-full text-[12px] font-normal whitespace-nowrap ${PO_STATUS[po.status]}`} style={{ left: 840 }}>{po.status}</span>
              <button className="absolute cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors" style={{ left: 1030 }}>
                <MoreVertical size={20} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────

const SALES = [
  { id: "SALE-001", patient: "Noah Carter",    rx: "RX-20251104", items: 5, total: 1351, mode: "UPI",  date: "13 Nov 2025" },
  { id: "SALE-002", patient: "Sophia Adams",   rx: "RX-20251103", items: 4, total: 680,  mode: "Cash", date: "9 Nov 2025"  },
  { id: "SALE-003", patient: "Walk-in",        rx: "—",           items: 2, total: 220,  mode: "Cash", date: "9 Nov 2025"  },
  { id: "SALE-004", patient: "William Scott",  rx: "RX-20251108", items: 3, total: 860,  mode: "Card", date: "8 Nov 2025"  },
  { id: "SALE-005", patient: "Olivia Turner",  rx: "RX-20251101", items: 3, total: 520,  mode: "UPI",  date: "8 Nov 2025"  },
];

const MODE_CLR: Record<string, string> = {
  UPI: "bg-[#d6eaff] text-[#007cff]", Cash: "bg-[#dffff3] text-[#00955c]", Card: "bg-[#fff2e0] text-[#ff9000]",
};

function SalesView() {
  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Quick billing bar */}
      <div className="border border-[#dedee1] rounded-[10px] p-5">
        <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Quick Billing</h3>
        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Patient / Prescription">
            <FormInput placeholder="Search Rx# or patient name" />
          </FormRow>
          <FormRow label="Medicine">
            <FormInput placeholder="Scan barcode or search" />
          </FormRow>
          <FormRow label="Payment Mode">
            <FormSelect placeholder="Select mode" options={[{ value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "card", label: "Credit / Debit Card" }, { value: "cheque", label: "Cheque" }]} />
          </FormRow>
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="text-[14px] font-medium text-[#11111c]">Total: <span className="text-[#009598]">₹ —</span></span>
          <button className="bg-[#009598] text-white text-[14px] font-normal px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">
            Generate Bill
          </button>
        </div>
      </div>

      {/* Recent sales */}
      <div>
        <h3 className="text-[14px] font-medium text-[#11111c] mb-3">Recent Sales</h3>
        <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
          <div className="relative h-10 bg-[#f2f3f3]">
            {[{ l: "Sale ID", x: 20 }, { l: "Patient", x: 140 }, { l: "Rx #", x: 330 }, { l: "Items", x: 500 }, { l: "Total", x: 620 }, { l: "Payment", x: 780 }, { l: "Date", x: 940 }].map(c => (
              <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
            ))}
          </div>
          {SALES.map(s => (
            <div key={s.id} className="relative flex items-center h-[56px] border-b border-[#dedee1] last:border-0 bg-white hover:bg-[#fafafa] transition-colors">
              <span className="absolute text-[14px] font-medium text-[#009598]" style={{ left: 20 }}>{s.id}</span>
              <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 140 }}>{s.patient}</span>
              <span className="absolute text-[14px] font-normal text-[#57575f]" style={{ left: 330 }}>{s.rx}</span>
              <span className="absolute text-[14px] font-normal text-[#11111c]" style={{ left: 500 }}>{s.items}</span>
              <span className="absolute text-[14px] font-medium text-[#11111c]" style={{ left: 620 }}>₹{s.total.toLocaleString("en-IN")}</span>
              <span className={`absolute inline-flex items-center px-[10px] py-[4px] rounded-full text-[12px] font-normal ${MODE_CLR[s.mode]}`} style={{ left: 780 }}>{s.mode}</span>
              <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 940 }}>{s.date}</span>
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
          {tab === "purchase" && <PurchaseView />}
          {tab === "sales"    && <SalesView />}
          {tab === "expiring" && <ExpiringView pharmacyItems={pharmacyItems} onReorder={reorder} onRemove={remove} />}
          {tab === "alerts"   && <AlertsView pharmacyItems={pharmacyItems} onReorder={reorder} onRemove={remove} />}
        </div>
      </div>
    </>
  );
}
