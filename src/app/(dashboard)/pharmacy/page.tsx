"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { Pill, Plus, MoreVertical, AlertTriangle, Clock, XCircle, TrendingDown } from "lucide-react";
import { pharmacyItems } from "@/data/pharmacy";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { PharmacyItem } from "@/types";

// ─── Inventory ────────────────────────────────────────────────────────────────

const INV_COLUMNS = [
  { label: "Medicine",  left: 20   }, { label: "Category",  left: 230  },
  { label: "Stock",     left: 420  }, { label: "Min Stock", left: 570  },
  { label: "Expiry",    left: 720  }, { label: "Supplier",  left: 890  },
  { label: "Status",    left: 1100 }, { label: "Action",    left: 1330 },
];
const INV_FILTERS = [
  { id: "All", label: "All" }, { id: "InStock", label: "In Stock" },
  { id: "LowStock", label: "Low Stock" }, { id: "OutOfStock", label: "Out of Stock" },
  { id: "Expired", label: "Expired" },
];
const MIN_WIDTH = 1452;

function InventoryRow({ row }: { row: PharmacyItem }) {
  const isLow = row.stock < row.minStock && row.stock > 0;
  const isOut = row.stock === 0;
  return (
    <div className={tw.table.dataRow} style={{ minWidth: MIN_WIDTH }}>
      <div className="absolute left-5">
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">{row.name}</span>
      </div>
      <div className="absolute" style={{ left: 230 }}>
        <span className="text-[14px] font-normal text-[#57575f] leading-[19px] whitespace-nowrap">{row.category}</span>
      </div>
      <div className="absolute" style={{ left: 420 }}>
        <span className={`text-[14px] font-medium leading-[19px] ${isOut ? "text-[#ff0004]" : isLow ? "text-[#ff9000]" : "text-[#11111c]"}`}>
          {row.stock} units
        </span>
      </div>
      <div className="absolute" style={{ left: 570 }}>
        <span className="text-[14px] font-normal text-[#57575f] leading-[19px]">{row.minStock}</span>
      </div>
      <div className="absolute" style={{ left: 720 }}>
        <span className={`text-[14px] font-normal leading-[19px] ${row.status === "Expired" ? "text-[#ff0004]" : "text-[#11111c]"}`}>{row.expiryDate}</span>
      </div>
      <div className="absolute" style={{ left: 890 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">{row.supplier}</span>
      </div>
      <div className="absolute" style={{ left: 1100 }}><StatusBadge status={row.status} /></div>
      <div className="absolute" style={{ left: 1330 }}>
        <button className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors">
          <MoreVertical size={24} strokeWidth={1.5} />
        </button>
      </div>
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

function AlertsView() {
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
        <button className="text-[12px] font-medium text-white bg-[#009598] px-4 py-[6px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap">
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

const TABS = [
  { id: "inventory", label: "Inventory",   count: pharmacyItems.length },
  { id: "purchase",  label: "Purchase" },
  { id: "sales",     label: "Sales" },
  { id: "alerts",    label: "Alerts", count: pharmacyItems.filter(i => ["Low Stock","Out of Stock","Expired"].includes(i.status)).length },
];

const PHARMA_FILTER_MAP: Record<string, string> = { "InStock": "In Stock", "LowStock": "Low Stock", "OutOfStock": "Out of Stock" };

export default function PharmacyPage() {
  const [tab, setTab] = useState("inventory");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const visible = pharmacyItems.filter(i => {
    const matchF = filter === "All" || i.status === (PHARMA_FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      <PageHeader
        title="Pharmacy"
        subtitle="Manage drug inventory, purchase orders, billing, and stock alerts."
        stats={[{ icon: Pill, value: `${visible.length}`, label: "Total Items" }]}
        action={{ label: "Add Item", icon: Plus }}
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
                {visible.map(r => <InventoryRow key={r.id} row={r} />)}
              </DataTable>
            </>
          )}
          {tab === "purchase" && <PurchaseView />}
          {tab === "sales"    && <SalesView />}
          {tab === "alerts"   && <AlertsView />}
        </div>
      </div>
    </>
  );
}
