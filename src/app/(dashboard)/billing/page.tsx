"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { BillDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { Bill } from "@/types";

// ─── All Bills ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Bill #",   width: "150px" },
  { label: "Patient",  width: "minmax(140px,1.4fr)" },
  { label: "Type",     width: "100px" },
  { label: "Date",     width: "110px" },
  { label: "Amount",   width: "100px", align: "right" as const },
  { label: "Discount", width: "90px", align: "right" as const },
  { label: "GST",      width: "80px", align: "right" as const },
  { label: "Total",    width: "110px", align: "right" as const },
  { label: "Status",   width: "110px" },
  { label: "Action",   width: "52px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Paid", label: "Paid" },
  { id: "Pending", label: "Pending" }, { id: "Partial", label: "Partial" },
  { id: "Refunded", label: "Refunded" },
];
const MIN_WIDTH = 1180;
const TYPE_COLORS: Record<string, string> = {
  OPD: "bg-[#d6eaff] text-[#007cff]", Pharmacy: "bg-[#fff2e0] text-[#ff9000]",
  Lab: "bg-[#dffff3] text-[#00955c]",  IPD: "bg-[#ffe9e9] text-[#ff0004]",
  Blood: "bg-[#ffe9e9] text-[#ff0004]", Ambulance: "bg-[#fff2e0] text-[#ff9000]",
  Radiology: "bg-[#e8f7f7] text-[#009598]",
};

function BillRow({ row, actions }: { row: Bill; actions: RowAction[] }) {
  return (
    <Link href={`/billing/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#009598] truncate">{row.billNumber}</span>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <div>
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${TYPE_COLORS[row.type] ?? "bg-[#f0f0f0] text-[#57575f]"}`}>{row.type}</span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.date}</span>
      <span className="text-[13px] font-normal text-[#11111c] text-right">₹{row.amount.toLocaleString("en-IN")}</span>
      <span className="text-[13px] font-normal text-[#57575f] text-right">{row.discount > 0 ? `₹${row.discount}` : "—"}</span>
      <span className="text-[13px] font-normal text-[#57575f] text-right">₹{row.gst.toFixed(0)}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">₹{row.total.toLocaleString("en-IN")}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

// ─── New Bill ─────────────────────────────────────────────────────────────────

type LineItem = { id: number; description: string; qty: number; rate: number; gstPct: number };
const GST_RATES = [0, 5, 12, 18];
const SERVICES = [
  "Consultation", "OPD Visit", "Emergency Consultation", "ECG", "Ultrasound",
  "X-Ray", "Blood Test - CBC", "Blood Test - LFT", "Blood Test - KFT",
  "Room Charge - General", "Room Charge - Semi-Private", "Room Charge - Private", "ICU Charge",
  "Operation Theatre", "Nursing Charge", "Diet Charge", "Physiotherapy Session",
  "Dressing & Bandage", "IV Fluids", "Oxygen Charge",
];
const PAYMENT_MODES = [
  { value: "cash", label: "Cash" }, { value: "upi", label: "UPI" },
  { value: "card", label: "Credit / Debit Card" }, { value: "neft", label: "NEFT / RTGS" },
  { value: "cheque", label: "Cheque" }, { value: "insurance", label: "Insurance" },
  { value: "split", label: "Split Payment" },
];

function NewBillView({ patients, onCreated }: { patients: PatientDTO[]; onCreated: () => void }) {
  const [items, setItems] = useState<LineItem[]>([
    { id: 1, description: "", qty: 1, rate: 0, gstPct: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [payMode, setPayMode] = useState("");
  const [patientId, setPatientId] = useState("");
  const [billType, setBillType] = useState("OPD");
  const { run, loading, error } = useMutation();

  const addRow = () => setItems(prev => [...prev, { id: Date.now(), description: "", qty: 1, rate: 0, gstPct: 0 }]);
  const removeRow = (id: number) => setItems(prev => prev.filter(i => i.id !== id));
  const updateRow = (id: number, field: keyof LineItem, value: string | number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const gstTotal = items.reduce((s, i) => s + (i.qty * i.rate * i.gstPct) / 100, 0);
  const discAmt = discount;
  const grandTotal = subtotal + gstTotal - discAmt;

  async function generate() {
    const patient = patients.find(p => String(p.id) === patientId);
    await run(() =>
      api.post("/billing", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        type: billType,
        amount: subtotal,
        discount: discAmt,
        status: payMode ? "Paid" : "Pending",
      }),
    );
    onCreated();
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Patient & type */}
      <div className="grid grid-cols-4 gap-4">
        <FormRow label="Patient *">
          <FormSelect placeholder="Search patient" value={patientId} onChange={setPatientId} options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} />
        </FormRow>
        <FormRow label="Bill Type *">
          <FormSelect placeholder="Select type" value={billType} onChange={setBillType} options={["OPD", "IPD", "Lab", "Pharmacy", "Radiology", "Blood", "Ambulance"].map(t => ({ value: t, label: t === "Blood" ? "Blood Issue" : t }))} />
        </FormRow>
        <FormRow label="Bill Date *">
          <FormInput type="date" />
        </FormRow>
        <FormRow label="Doctor / Reference">
          <FormInput placeholder="Referring doctor" />
        </FormRow>
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-[#11111c]">Line Items</h3>
          <button onClick={addRow} className="flex items-center gap-[5px] text-[12px] font-normal text-[#009598] hover:underline">
            <Plus size={13} /> Add Item
          </button>
        </div>
        {/* Header */}
        <div className="grid grid-cols-[2fr_80px_100px_100px_120px_40px] gap-2 px-3">
          {["Description", "Qty", "Rate (₹)", "GST %", "Amount (₹)", ""].map(h => (
            <span key={h} className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">{h}</span>
          ))}
        </div>
        {/* Rows */}
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="grid grid-cols-[2fr_80px_100px_100px_120px_40px] gap-2 items-center">
              <select
                value={item.description}
                onChange={e => updateRow(item.id, "description", e.target.value)}
                className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
              >
                <option value="">Select service...</option>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="number" min={1} value={item.qty}
                onChange={e => updateRow(item.id, "qty", Number(e.target.value))}
                className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors text-center"
              />
              <input
                type="number" min={0} value={item.rate || ""}
                onChange={e => updateRow(item.id, "rate", Number(e.target.value))}
                placeholder="0"
                className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
              />
              <select
                value={item.gstPct}
                onChange={e => updateRow(item.id, "gstPct", Number(e.target.value))}
                className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
              >
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
              <span className="text-[13px] font-medium text-[#11111c] px-3">
                ₹{(item.qty * item.rate * (1 + item.gstPct / 100)).toLocaleString("en-IN")}
              </span>
              {items.length > 1 ? (
                <button onClick={() => removeRow(item.id)} className="flex items-center justify-center text-[#ff0004] hover:text-red-700 transition-colors">
                  <Trash2 size={15} />
                </button>
              ) : <div />}
            </div>
          ))}
        </div>
      </div>

      {/* Payment & totals */}
      <div className="grid grid-cols-2 gap-6">
        {/* Payment mode */}
        <div className="flex flex-col gap-4">
          <FormRow label="Payment Mode *">
            <FormSelect placeholder="Select payment mode" options={PAYMENT_MODES} />
          </FormRow>
          <FormRow label="Discount (₹)">
            <input
              type="number" min={0} value={discount || ""}
              onChange={e => setDiscount(Number(e.target.value))}
              placeholder="0"
              className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] text-[14px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
            />
          </FormRow>
          <FormRow label="Notes">
            <textarea
              rows={2}
              placeholder="Payment remarks or notes..."
              className="w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] py-[10px] text-[14px] font-normal text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none focus:border-[#009598] transition-colors resize-none"
            />
          </FormRow>
        </div>
        {/* Total summary */}
        <div className="border border-[#dedee1] rounded-[10px] p-5 flex flex-col gap-3 bg-[#f6f6f6] h-fit">
          {[
            { label: "Subtotal",    value: `₹${subtotal.toLocaleString("en-IN")}` },
            { label: "GST",         value: `₹${gstTotal.toFixed(0)}` },
            { label: "Discount",    value: discAmt > 0 ? `-₹${discAmt.toLocaleString("en-IN")}` : "—" },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-[13px]">
              <span className="font-normal text-[#57575f]">{r.label}</span>
              <span className="font-normal text-[#11111c]">{r.value}</span>
            </div>
          ))}
          <div className="border-t border-[#dedee1] pt-3 flex justify-between">
            <span className="text-[16px] font-medium text-[#11111c]">Grand Total</span>
            <span className="text-[16px] font-medium text-[#009598]">₹{grandTotal.toLocaleString("en-IN")}</span>
          </div>
          <button onClick={generate} disabled={loading || !patientId || subtotal <= 0}
            className="w-full mt-2 bg-[#009598] text-white text-[14px] font-normal py-[10px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
            {loading ? "Generating…" : "Generate Bill"}
          </button>
          {error && <div className="text-[12px] text-[#ff0004]">{error.message}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Bill Lookup ──────────────────────────────────────────────────────────────

function LookupView({ bills }: { bills: BillDTO[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? bills.filter(b =>
        b.billNumber.toLowerCase().includes(q) ||
        b.patientName.toLowerCase().includes(q) ||
        String(b.id) === q)
    : [];
  const outstanding = matches
    .filter(b => b.status === "Pending" || b.status === "Partial")
    .reduce((s, b) => s + b.total, 0);

  return (
    <div className="p-5 flex flex-col gap-5" style={{ minHeight: 560 }}>
      <div className="max-w-[560px]">
        <FormRow label="Bill Number / Patient Name" hint="Find every bill for a patient or a specific invoice across all departments">
          <FormInput placeholder="e.g. INV-00000004 or Rajan Mehta" value={query} onChange={setQuery} />
        </FormRow>
      </div>

      {q && matches.length === 0 && (
        <div className="py-12 text-center text-[14px] text-[#57575f]">No bills match “{query}”.</div>
      )}

      {matches.length > 0 && (
        <>
          <div className="flex items-center gap-6 px-4 py-3 bg-[#f6f6f6] rounded-[10px]">
            <div>
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Bills Found</span>
              <p className="text-[20px] font-medium text-[#11111c] leading-tight">{matches.length}</p>
            </div>
            <div className="w-px h-8 bg-[#dedee1]" />
            <div>
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Total Billed</span>
              <p className="text-[20px] font-medium text-[#11111c] leading-tight">₹{matches.reduce((s, b) => s + b.total, 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="w-px h-8 bg-[#dedee1]" />
            <div>
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Outstanding</span>
              <p className={`text-[20px] font-medium leading-tight ${outstanding > 0 ? "text-[#ff9000]" : "text-[#00955c]"}`}>₹{outstanding.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {matches.map(b => (
              <Link key={b.id} href={`/billing/${b.id}`}
                className="border border-[#dedee1] rounded-[10px] p-4 flex items-start justify-between gap-4 bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="flex flex-col gap-[6px]">
                  <span className="text-[14px] font-medium text-[#009598]">{b.billNumber}</span>
                  <span className="text-[13px] font-normal text-[#11111c]">{b.patientName}</span>
                  <span className="text-[12px] font-light text-[#57575f]">{b.type} · {b.date}</span>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[15px] font-medium text-[#11111c]">₹{b.total.toLocaleString("en-IN")}</span>
                  <StatusBadge status={b.status} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { items: bills, reload } = useList<BillDTO>("/billing", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove, mutate } = useRowActions("billing", reload);

  const TABS = [
    { id: "all",     label: "All Bills", count: bills.length },
    { id: "new",     label: "New Bill" },
    { id: "lookup",  label: "Bill Lookup" },
  ];

  const revenue = bills
    .filter(b => b.status === "Paid" || b.status === "Partial")
    .reduce((s, b) => s + b.total, 0);

  const visible = bills.filter(b => {
    const matchF = filter === "All" || b.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || b.billNumber.toLowerCase().includes(q) || b.patientName.toLowerCase().includes(q) || b.type.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <PageHeader
        title="Billing"
        subtitle="Manage patient invoices, payments, discounts, and financial records."
        stats={[{ icon: BarChart3, value: `₹${revenue.toLocaleString("en-IN")}`, label: "Revenue (Nov)" }]}
        action={{ label: "New Bill", icon: Plus, onClick: () => setTab("new") }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "all" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by bill number or patient name..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No bills found.</div>
                ) : visible.map(r => (
                  <BillRow key={r.id} row={r} actions={[
                    { label: "View invoice", onClick: () => router.push(`/billing/${r.id}`) },
                    { label: "Mark Paid", disabled: r.status === "Paid", onClick: () => mutate(() => api.patch(`/billing/${r.id}`, { status: "Paid" })) },
                    { label: "Mark Pending", disabled: r.status === "Pending", onClick: () => mutate(() => api.patch(`/billing/${r.id}`, { status: "Pending" })) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.billNumber) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "new" && <NewBillView patients={patients} onCreated={() => { reload(); setTab("all"); }} />}
          {tab === "lookup" && <LookupView bills={bills} />}
        </div>
      </div>
    </>
  );
}
