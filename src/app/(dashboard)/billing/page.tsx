"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { inDateRange, type DateRangeId, formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { BillDTO, BillingCatalogDTO, PatientDTO } from "@/types/api";
import { priceLines, r2 } from "@/types/billing";
import { splitCoverage } from "@/types/coverage";
import { PayoutsView } from "@/components/billing/PayoutsView";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
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
const MIN_WIDTH = 1220;
const TYPE_COLORS: Record<string, string> = {
  OPD: "bg-[#d6eaff] text-[#007cff]", Pharmacy: "bg-[#fff2e0] text-[#ff9000]",
  Lab: "bg-[#dffff3] text-[#00955c]",  IPD: "bg-[#ffe9e9] text-[#ff0004]",
  Blood: "bg-[#ffe9e9] text-[#ff0004]", Ambulance: "bg-[#fff2e0] text-[#ff9000]",
  Radiology: "bg-[color:var(--brand-soft)] text-[color:var(--brand)]",
};

function BillRow({ row, actions }: { row: Bill; actions: RowAction[] }) {
  return (
    <Link href={`/billing/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[color:var(--brand)] truncate">{row.billNumber}</span>
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{row.patientName}</span>
      <div>
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${TYPE_COLORS[row.type] ?? "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>{row.type}</span>
      </div>
      <span className="text-[13px] font-normal text-[color:var(--ink)] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] text-right">₹{row.amount.toLocaleString("en-IN")}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)] text-right">{row.discount > 0 ? `₹${row.discount}` : "—"}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)] text-right">₹{row.gst.toFixed(0)}</span>
      <span className="text-[13px] font-medium text-[color:var(--ink)] text-right">₹{row.total.toLocaleString("en-IN")}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

// ─── New Bill ─────────────────────────────────────────────────────────────────

/** A line on the bill being built: a catalogue service (priced and taxed by the server's rate plan) or a custom charge. */
interface LineItem { id: number; serviceId: string; description: string; qty: number; rate: number; gstPct: number }
const GST_RATES = [0, 5, 12, 18, 28];
const CUSTOM = "custom";
const blankLine = (): LineItem => ({ id: Date.now() + Math.random(), serviceId: "", description: "", qty: 1, rate: 0, gstPct: 0 });
const rupee = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function NewBillView({ patients, onCreated }: { patients: PatientDTO[]; onCreated: () => void }) {
  const [items, setItems] = useState<LineItem[]>([blankLine()]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [payMode, setPayMode] = useState("");
  const [patientId, setPatientId] = useState("");
  const [billType, setBillType] = useState("OPD");
  const { run, loading, error } = useMutation();
  // Prices, GST and payment modes come from Setup → Masters; the patient's category picks the rate plan.
  const { item: base } = useItem<BillingCatalogDTO>(patientId ? `/billing/catalog?patientId=${patientId}` : "/billing/catalog");
  // A patient covered by a sponsor contract is billed under it unless the cashier says self-pay; a contract that names its own
  // rate plan prices the bill from that plan.
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const [doctorId, setDoctorId] = useState("");
  const contracts = base?.contracts ?? [];
  const contract = choice === "self" ? null : contracts.find(c => String(c.id) === choice) ?? (choice === undefined ? contracts[0] : undefined) ?? null;
  const { item: viaContract } = useItem<BillingCatalogDTO>(patientId && contract?.ratePlan ? `/billing/catalog?patientId=${patientId}&contractId=${contract.id}` : null);
  const catalog = contract?.ratePlan && viaContract ? viaContract : base;
  const services = catalog?.services ?? [];
  const settings = catalog?.settings ?? { gstOnBills: true, pricesInclusive: false, roundOff: true, invoicePrefix: "" };

  const updateRow = (id: number, patch: Partial<LineItem>) => setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const pick = (id: number, value: string) => {
    if (value === CUSTOM) return updateRow(id, { serviceId: CUSTOM, description: "", rate: 0, gstPct: 0 });
    const svc = services.find(s => String(s.id) === value);
    if (svc) updateRow(id, { serviceId: value, description: svc.name, rate: svc.price, gstPct: svc.gstRate });
  };
  // A price list is per patient, so changing the patient re-prices the catalogue lines already on the bill.
  const priced = items.map(i => {
    if (i.serviceId && i.serviceId !== CUSTOM) {
      const svc = services.find(s => String(s.id) === i.serviceId);
      if (svc) return { ...i, rate: svc.price, gstPct: svc.gstRate };
    }
    return i;
  });
  const filled = priced.filter(i => i.serviceId && (i.serviceId !== CUSTOM || (i.description.trim() && i.rate >= 0)));

  const subtotal = filled.reduce((s, i) => s + i.qty * i.rate, 0);
  const discAmt = Math.min(subtotal, discountType === "percent" ? subtotal * (Math.min(100, Math.max(0, discount)) / 100) : Math.max(0, discount));
  const totals = priceLines(filled.map(i => ({ quantity: i.qty, unitPrice: i.rate, gstRate: i.gstPct })), r2(discAmt), settings);

  // Who pays what, by the contract's rules — the server works it out again when the bill is saved.
  const split = contract ? splitCoverage(contract.terms, filled.map((i, n) => {
    const svc = services.find(x => String(x.id) === i.serviceId);
    return { name: i.description || svc?.name || "", code: svc?.code ?? "", groupIds: svc?.groupIds ?? [], groupNames: svc?.groupNames ?? [], quantity: i.qty, total: totals.totals[n] };
  }), contract.past, { today: new Date().toLocaleDateString("en-CA"), contractFrom: contract.validFrom }) : null;
  const payerShare = split ? Math.min(split.payer, totals.total) : 0;

  async function generate() {
    const patient = patients.find(p => String(p.id) === patientId);
    await run(() =>
      api.post("/billing", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        type: billType,
        ...(contract ? { contractId: contract.id } : {}),
        ...(doctorId ? { doctorId: Number(doctorId) } : {}),
        discount: r2(discAmt),
        status: payMode ? "Paid" : "Pending",
        paymentMode: payMode || undefined,
        items: filled.map(i => i.serviceId === CUSTOM
          ? { description: i.description, quantity: i.qty, unitPrice: i.rate, gstRate: i.gstPct }
          : { serviceId: Number(i.serviceId), quantity: i.qty }),
      }),
    );
    onCreated();
  }

  const input = "h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] font-normal text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";
  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Patient & type */}
      <div className="grid grid-cols-4 gap-4">
        <FormRow label="Patient *" hint={catalog?.planName ? `Prices from ${catalog.planName}` : undefined}>
          <SearchSelect
            placeholder="Search patient by name, ID or phone…"
            value={patientId}
            onChange={v => { setPatientId(v); setChoice(undefined); }}
            options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
          />
        </FormRow>
        <FormRow label="Bill Type *">
          <FormSelect placeholder="Select type" value={billType} onChange={setBillType} options={["OPD", "IPD", "Lab", "Pharmacy", "Radiology", "Blood", "Ambulance"].map(t => ({ value: t, label: t === "Blood" ? "Blood Issue" : t }))} />
        </FormRow>
        <FormRow label="Bill Date *">
          <FormInput type="date" />
        </FormRow>
        <FormRow label="Doctor" hint="Doctor payout rules follow the doctor named here">
          <FormSelect value={doctorId} onChange={setDoctorId} options={[{ value: "", label: "None" }, ...(catalog?.doctors ?? []).map(d => ({ value: String(d.id), label: d.name }))]} />
        </FormRow>
      </div>
      {contracts.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <FormRow label="Bill to" hint={contract ? `${contract.sponsor}${contract.validTo ? ` · valid to ${contract.validTo}` : ""}` : "The patient pays the whole bill"}>
              <FormSelect value={contract ? String(contract.id) : "self"} onChange={v => setChoice(v)} options={[...contracts.map(c => ({ value: String(c.id), label: c.name })), { value: "self", label: "Self pay" }]} />
            </FormRow>
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-[color:var(--ink)]">Line Items</h3>
          <button onClick={() => setItems(prev => [...prev, blankLine()])} className="flex items-center gap-[5px] text-[12px] font-normal text-[color:var(--brand)] hover:underline">
            <Plus size={13} /> Add Item
          </button>
        </div>
        <div className="grid grid-cols-[2fr_80px_110px_100px_120px_40px] gap-2 px-3">
          {["Service", "Qty", "Rate (₹)", "GST %", "Amount (₹)", ""].map(h => (
            <span key={h} className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{h}</span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {priced.map((item, idx) => {
            const custom = item.serviceId === CUSTOM;
            const raw = items[idx];
            return (
              <div key={item.id} className="grid grid-cols-[2fr_80px_110px_100px_120px_40px] gap-2 items-center">
                <div className="flex flex-col gap-1 min-w-0">
                  <SearchSelect
                    placeholder="Select service…"
                    value={raw.serviceId}
                    onChange={v => pick(item.id, v)}
                    options={[...services.map(s => ({ value: String(s.id), label: s.name, hint: `${s.code} ${s.group}` })), { value: CUSTOM, label: "Custom charge…", hint: "not in the catalogue" }]}
                  />
                  {custom && <input value={raw.description} onChange={e => updateRow(item.id, { description: e.target.value })} placeholder="Describe the charge" aria-label="Charge description" className={input} />}
                </div>
                <input type="number" min={1} value={item.qty} onChange={e => updateRow(item.id, { qty: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} className={`${input} text-center`} aria-label="Quantity" />
                {custom
                  ? <input type="number" min={0} value={raw.rate || ""} onChange={e => updateRow(item.id, { rate: Number(e.target.value) })} placeholder="0" className={input} aria-label="Rate" />
                  : <span className="text-[13px] text-[color:var(--ink)] px-3" title="Set by the rate plan">{item.serviceId ? rupee(item.rate) : "—"}</span>}
                {custom
                  ? <select value={raw.gstPct} onChange={e => updateRow(item.id, { gstPct: Number(e.target.value) })} className={input} aria-label="GST rate">{GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</select>
                  : <span className="text-[13px] text-[color:var(--ink-soft)] px-3">{item.serviceId ? (settings.gstOnBills ? `${item.gstPct}%` : "off") : "—"}</span>}
                <span className="text-[13px] font-medium text-[color:var(--ink)] px-3">{rupee(item.qty * item.rate)}</span>
                {items.length > 1 ? (
                  <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} aria-label="Remove line" className="flex items-center justify-center text-[#ff0004] hover:text-red-700 transition-colors">
                    <Trash2 size={15} />
                  </button>
                ) : <div />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment & totals */}
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <FormRow label="Payment Mode" hint="Leave empty to raise the bill as Pending; choose a mode to record it as paid.">
            <FormSelect placeholder="Select payment mode" value={payMode} onChange={setPayMode} options={[{ value: "", label: "Not paid yet (Pending)" }, ...(catalog?.paymentModes ?? []).map(m => ({ value: m, label: m }))]} />
          </FormRow>
          <FormRow label="Discount">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[color:var(--subtle)] rounded-[8px] p-[3px] shrink-0">
                {([{ id: "flat", label: "₹" }, { id: "percent", label: "%" }] as const).map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDiscountType(o.id)}
                    className={`w-8 h-9 rounded-[6px] text-[13px] font-medium transition-colors ${
                      discountType === o.id ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <input
                type="number" min={0} max={discountType === "percent" ? 100 : undefined} value={discount || ""}
                onChange={e => setDiscount(Number(e.target.value))}
                placeholder="0"
                className="h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-[14px] text-[14px] font-normal text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
              />
            </div>
          </FormRow>
          <FormRow label="Notes">
            <textarea
              rows={2}
              placeholder="Payment remarks or notes..."
              className="w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-[14px] py-[10px] text-[14px] font-normal text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none focus:border-[color:var(--brand)] transition-colors resize-none"
            />
          </FormRow>
        </div>
        <div className="border border-[color:var(--line)] rounded-[10px] p-5 flex flex-col gap-3 bg-[color:var(--subtle)] h-fit">
          {[
            { label: "Subtotal", value: rupee(totals.amount) },
            { label: settings.pricesInclusive ? "GST (included in prices)" : "GST", value: settings.gstOnBills ? rupee(totals.gst) : "Off" },
            { label: discountType === "percent" && discount > 0 ? `Discount (${discount}%)` : "Discount", value: discAmt > 0 ? `-${rupee(r2(discAmt))}` : "—" },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-[13px]">
              <span className="font-normal text-[color:var(--ink-soft)]">{r.label}</span>
              <span className="font-normal text-[color:var(--ink)]">{r.value}</span>
            </div>
          ))}
          <div className="border-t border-[color:var(--line)] pt-3 flex justify-between">
            <span className="text-[16px] font-medium text-[color:var(--ink)]">Grand Total</span>
            <span className="text-[16px] font-medium text-[color:var(--brand)]">{rupee(totals.total)}</span>
          </div>
          {split && contract && (
            <div className="flex flex-col gap-1 rounded-[8px] border border-[color:var(--line)] bg-white px-3 py-2" data-testid="coverage-split">
              <div className="flex justify-between text-[13px]"><span className="text-[color:var(--ink-soft)]">{contract.sponsor || "Payer"} pays</span><span className="font-medium text-[color:var(--ink)]">{rupee(payerShare)}</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[color:var(--ink-soft)]">Patient pays</span><span className="font-medium text-[color:var(--ink)]">{rupee(r2(totals.total - payerShare))}</span></div>
              {split.lines.some(l => l.patient > 0) && (
                <ul className="mt-1 flex flex-col gap-[2px] text-[11px] text-[color:var(--ink-soft)]">
                  {split.lines.map((l, n) => l.patient > 0 && <li key={n}>{filled[n].description || services.find(x => String(x.id) === filled[n].serviceId)?.name}: patient {rupee(l.patient)} — {l.note}</li>)}
                </ul>
              )}
            </div>
          )}
          <button onClick={generate} disabled={loading || !patientId || filled.length === 0}
            className="w-full mt-2 bg-[color:var(--brand)] text-white text-[14px] font-normal py-[10px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
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
        <div className="py-12 text-center text-[14px] text-[color:var(--ink-soft)]">No bills match “{query}”.</div>
      )}

      {matches.length > 0 && (
        <>
          <div className="flex items-center gap-6 px-4 py-3 bg-[color:var(--subtle)] rounded-[10px]">
            <div>
              <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Bills Found</span>
              <p className="text-[20px] font-medium text-[color:var(--ink)] leading-tight">{matches.length}</p>
            </div>
            <div className="w-px h-8 bg-[color:var(--line)]" />
            <div>
              <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Total Billed</span>
              <p className="text-[20px] font-medium text-[color:var(--ink)] leading-tight">₹{matches.reduce((s, b) => s + b.total, 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="w-px h-8 bg-[color:var(--line)]" />
            <div>
              <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Outstanding</span>
              <p className={`text-[20px] font-medium leading-tight ${outstanding > 0 ? "text-[#ff9000]" : "text-[#00955c]"}`}>₹{outstanding.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {matches.map(b => (
              <Link key={b.id} href={`/billing/${b.id}`}
                className="border border-[color:var(--line)] rounded-[10px] p-4 flex items-start justify-between gap-4 bg-[color:var(--surface)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
                <div className="flex flex-col gap-[6px]">
                  <span className="text-[14px] font-medium text-[color:var(--brand)]">{b.billNumber}</span>
                  <span className="text-[13px] font-normal text-[color:var(--ink)]">{b.patientName}</span>
                  <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{b.type} · {b.date}</span>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[15px] font-medium text-[color:var(--ink)]">₹{b.total.toLocaleString("en-IN")}</span>
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
  const { can } = useAuth();
  const canWrite = can("billing", "write");
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRangeId>("all");
  const router = useRouter();
  const { items: bills, reload } = useList<BillDTO>("/billing", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove, mutate } = useRowActions("billing", reload);

  const TABS = [
    { id: "all",     label: "All Bills", count: bills.length },
    ...(canWrite ? [{ id: "new", label: "New Bill" }] : []),
    { id: "lookup",  label: "Bill Lookup" },
    { id: "payouts", label: "Payouts" },
  ];

  const revenue = bills
    .filter(b => b.status === "Paid" || b.status === "Partial")
    .reduce((s, b) => s + b.total, 0);

  const visible = bills.filter(b => {
    const matchF = filter === "All" || b.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || b.billNumber.toLowerCase().includes(q) || b.patientName.toLowerCase().includes(q) || b.type.toLowerCase().includes(q);
    return matchF && matchS && inDateRange(b.date, range);
  });

  const { rows: pagedVisible, bar: barVisible } = usePagination(visible, "bills");

  return (
    <>
      {dialog}
      <PageHeader
        title="Billing"
        subtitle="Manage patient invoices, payments, discounts, and financial records."
        stats={[{ icon: BarChart3, value: `₹${revenue.toLocaleString("en-IN")}`, label: "Revenue (Nov)" }]}
        action={canWrite ? { label: "New Bill", icon: Plus, onClick: () => setTab("new") } : undefined}
        range={range}
        onRangeChange={setRange}
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
                  <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No bills found.</div>
                ) : pagedVisible.map(r => (
                  <BillRow key={r.id} row={r} actions={[
                    { label: "View invoice", onClick: () => router.push(`/billing/${r.id}`) },
                    ...(canWrite ? [
                      { label: "Mark Paid", disabled: r.status === "Paid", onClick: () => mutate(() => api.patch(`/billing/${r.id}`, { status: "Paid" })) },
                      { label: "Mark Pending", disabled: r.status === "Pending", onClick: () => mutate(() => api.patch(`/billing/${r.id}`, { status: "Pending" })) },
                      { label: "Delete", danger: true, onClick: () => remove(r.id, r.billNumber) },
                    ] : []),
                  ]} />
                ))}
              </DataTable>
{barVisible}
            </>
          )}
          {tab === "new" && <NewBillView patients={patients} onCreated={() => { reload(); setTab("all"); }} />}
          {tab === "lookup" && <LookupView bills={bills} />}
          {tab === "payouts" && <PayoutsView canWrite={canWrite} />}
        </div>
      </div>
    </>
  );
}
