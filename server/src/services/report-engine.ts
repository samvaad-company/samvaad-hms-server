/**
 * The Reports catalogue: every report the hospital can run, grouped as the Reports screen lists them, and the code that runs
 * each one against live data. A report is a table (columns + rows, optionally a totals row and a few headline figures) so the
 * screen can show, print and export all of them the same way.
 *
 * A report whose figures this system doesn't record (cheque details, TDS deducted, incident forms …) is still listed, flagged
 * `available: false`, so the catalogue reads complete without ever showing a made-up number.
 */
import {
  appointmentsRepo, bedsRepo, bedTransfersRepo, billItemsRepo, billPayoutsRepo, billsRepo, birthRecordsRepo, doctorsRepo, financeExpensesRepo,
  financeIncomesRepo, ipdRepo, labRepo, opdRepo, otRepo, patientsRepo, pharmacyBatchesRepo, pharmacyRepo, pharmacyReturnsRepo, radiologyRepo, wardsRepo,
} from "@/repositories";
import type {
  AppointmentRow, BedRow, BedTransferRow, BillItemRow, BillPayoutRow, BillRow, BirthRecordRow, DoctorRow, FinanceExpenseRow, FinanceIncomeRow, IpdAdmissionRow,
  LabTestRow, OpdVisitRow, OtScheduleRow, PatientRow, PharmacyBatchRow, PharmacyItemRow, PharmacyReturnRow, RadiologyTestRow, WardRow,
} from "@/db/tables";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";
import { listSetup } from "@/services/setup-service";
import { groupChain } from "@/services/coverage-service";
import { localDate } from "@/lib/clock";
import { ValidationError } from "@/lib/errors";

export type Fmt = "text" | "int" | "money" | "date" | "pct";
export interface Col { key: string; label: string; fmt?: Fmt }
export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export interface ReportResult {
  columns: Col[];
  rows: Row[];
  /** A closing row (sums of the numeric columns). */
  totals?: Row;
  /** Headline figures shown above the table. */
  summary?: { label: string; value: Cell; fmt?: Fmt }[];
  note?: string;
}

export const CATEGORIES = [
  "Cashier & collection", "Billing & revenue", "OPD / IPD registers", "Clinical & diagnostic", "Accounts & statutory", "Patient retention", "Pharmacy & stores",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** What the report asks for: a date range, one day, an "as on" date, a patient, or nothing. */
export type ReportParam = "range" | "day" | "asof" | "patient" | "none";

export interface ReportMeta { id: string; title: string; category: Category; description: string; param: ReportParam; available: boolean }

interface Ctx { data: Data; from: string; to: string; q: string; today: string }
interface Def extends Omit<ReportMeta, "available"> { run?: (c: Ctx) => Promise<ReportResult>; why?: string }

// ─── Data ────────────────────────────────────────────────────────────────────

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

/** Each table is read at most once per run, and only if the report asks for it. */
class Data {
  private cache = new Map<string, Promise<unknown>>();
  constructor(readonly actor: Session) {}
  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, load());
    return this.cache.get(key) as Promise<T>;
  }
  patients = () => this.memo("patients", () => all<PatientRow>(patientsRepo, this.actor));
  bills = () => this.memo("bills", () => all<BillRow>(billsRepo, this.actor));
  items = () => this.memo("items", () => all<BillItemRow>(billItemsRepo, this.actor));
  payouts = () => this.memo("payouts", () => all<BillPayoutRow>(billPayoutsRepo, this.actor));
  appts = () => this.memo("appts", () => all<AppointmentRow>(appointmentsRepo, this.actor));
  opd = () => this.memo("opd", () => all<OpdVisitRow>(opdRepo, this.actor));
  ipd = () => this.memo("ipd", () => all<IpdAdmissionRow>(ipdRepo, this.actor));
  beds = () => this.memo("beds", () => all<BedRow>(bedsRepo, this.actor));
  wards = () => this.memo("wards", () => all<WardRow>(wardsRepo, this.actor));
  transfers = () => this.memo("transfers", () => all<BedTransferRow>(bedTransfersRepo, this.actor));
  ot = () => this.memo("ot", () => all<OtScheduleRow>(otRepo, this.actor));
  labs = () => this.memo("labs", () => all<LabTestRow>(labRepo, this.actor));
  rads = () => this.memo("rads", () => all<RadiologyTestRow>(radiologyRepo, this.actor));
  births = () => this.memo("births", () => all<BirthRecordRow>(birthRecordsRepo, this.actor));
  doctors = () => this.memo("doctors", () => all<DoctorRow>(doctorsRepo, this.actor));
  pharmacy = () => this.memo("pharmacy", () => all<PharmacyItemRow>(pharmacyRepo, this.actor));
  batches = () => this.memo("batches", () => all<PharmacyBatchRow>(pharmacyBatchesRepo, this.actor));
  returns = () => this.memo("returns", () => all<PharmacyReturnRow>(pharmacyReturnsRepo, this.actor));
  expenses = () => this.memo("expenses", () => all<FinanceExpenseRow>(financeExpensesRepo, this.actor));
  incomes = () => this.memo("incomes", () => all<FinanceIncomeRow>(financeIncomesRepo, this.actor));
  /** service id → the name of the group it is filed under. */
  serviceGroups = () => this.memo("serviceGroups", async () => {
    const [services, groups] = await Promise.all([listSetup("service", this.actor), listSetup("service_group", this.actor)]);
    return new Map(services.map((s) => [s.id, groupChain(s.data.groupId, groups).names[0] ?? "Ungrouped"] as const));
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const r2 = (n: number): number => Math.round(n * 100) / 100;
/** What the patient paid on a settled bill (the sponsor's share is paid by the sponsor, not at the counter). */
const received = (b: BillRow): number => r2(Number(b.patient_share ?? b.total));
const dayOf = (ts: string | null | undefined): string => (ts ? localDate(new Date(ts)) : "");
const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const daysBetween = (a: string, b: string): number => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
const within = (d: string | null | undefined, c: Ctx): boolean => !!d && d >= c.from && d <= c.to;
const text = (v: unknown): string => (v == null ? "" : String(v));

function group<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) { const k = key(r) || "—"; (out.get(k) ?? out.set(k, []).get(k)!).push(r); }
  return out;
}

/** The report's totals row: the sum of every money / count column named. */
function sums(rows: Row[], keys: string[], label?: { key: string; text: string }): Row {
  const t: Row = {};
  if (label) t[label.key] = label.text;
  for (const k of keys) t[k] = r2(rows.reduce((n, r) => n + (Number(r[k]) || 0), 0));
  return t;
}

const table = (columns: Col[], rows: Row[], totalKeys: string[] = [], totalLabel?: string): ReportResult => ({
  columns, rows, totals: totalKeys.length && rows.length ? sums(rows, totalKeys, columns[0] ? { key: columns[0].key, text: totalLabel ?? "Total" } : undefined) : undefined,
});

const c = (key: string, label: string, fmt: Fmt = "text"): Col => ({ key, label, fmt });
const NAME = c("name", "Name");

/** A grouped count + amount table: `key` picks the bucket, `amount` the money. */
function grouped<T>(rows: T[], by: string, key: (r: T) => string, amount?: (r: T) => number, extra: Col[] = []): ReportResult {
  const out = [...group(rows, key)].map(([k, list]) => ({ name: k, count: list.length, ...(amount ? { amount: r2(list.reduce((n, r) => n + amount(r), 0)) } : {}) } as Row));
  out.sort((a, b) => Number(b.amount ?? b.count) - Number(a.amount ?? a.count));
  return table([c("name", by), c("count", "Count", "int"), ...(amount ? [c("amount", "Amount", "money")] : []), ...extra], out, amount ? ["count", "amount"] : ["count"]);
}

// ─── Cashier & collection ────────────────────────────────────────────────────

const settled = (bills: BillRow[], c: Ctx, types?: string[]) =>
  bills.filter((b) => b.status === "Paid" && within(b.bill_date, c) && (!types || types.includes(b.type)));

function receiptsTable(bills: BillRow[], note?: string): ReportResult {
  const rows = bills.map((b) => ({ bill: b.bill_number, patient: b.patient_name, type: b.type, mode: b.payment_mode || "Not recorded", amount: received(b) } as Row));
  const byMode = [...group(bills, (b) => b.payment_mode || "Not recorded")].map(([label, list]) => ({ label: `${label}`, value: r2(list.reduce((n, b) => n + received(b), 0)), fmt: "money" as Fmt }));
  return {
    ...table([c("bill", "Bill no."), c("patient", "Patient"), c("type", "Type"), c("mode", "Payment mode"), c("amount", "Amount", "money")], rows, ["amount"]),
    summary: byMode, note,
  };
}

const dayBook = (title: string, id: string, description: string, types?: string[]): Def => ({
  id, title, category: "Cashier & collection", description, param: "day",
  run: async (x) => receiptsTable(settled(await x.data.bills(), { ...x, to: x.from }, types), "Receipts are the bills settled on the day; the sponsor's share isn't counted."),
});

const dayBookGrouped = (id: string, title: string, description: string, by: string, key: (b: BillRow, g: Map<number, string>, items: Map<number, BillItemRow[]>) => string[]): Def => ({
  id, title, category: "Cashier & collection", description, param: "day",
  run: async (x) => {
    const [bills, items, groups] = await Promise.all([x.data.bills(), x.data.items(), x.data.serviceGroups()]);
    const byBill = group(items, (i) => String(i.bill_id));
    const itemMap = new Map([...byBill].map(([k, v]) => [Number(k), v] as const));
    const tally = new Map<string, { count: number; amount: number }>();
    for (const b of settled(bills, { ...x, to: x.from })) {
      for (const k of key(b, groups, itemMap)) {
        const t = tally.get(k) ?? { count: 0, amount: 0 };
        t.count++; t.amount += received(b);
        tally.set(k, t);
      }
    }
    return table([c("name", by), c("count", "Bills", "int"), c("amount", "Amount", "money")], [...tally].map(([name, t]) => ({ name, count: t.count, amount: r2(t.amount) })).sort((a, b) => b.amount - a.amount), ["count", "amount"]);
  },
});

const closing = (id: string, title: string, description: string, types?: string[]): Def => ({
  id, title, category: "Cashier & collection", description, param: "day",
  run: async (x) => {
    const bills = settled(await x.data.bills(), { ...x, to: x.from }, types);
    const raised = (await x.data.bills()).filter((b) => b.bill_date === x.from && (!types || types.includes(b.type)));
    const rows = [...group(bills, (b) => b.payment_mode || "Not recorded")].map(([mode, list]) => ({ name: mode, count: list.length, amount: r2(list.reduce((n, b) => n + received(b), 0)) } as Row));
    return {
      ...table([c("name", "Payment mode"), c("count", "Receipts", "int"), c("amount", "Collected", "money")], rows, ["count", "amount"]),
      summary: [
        { label: "Bills raised", value: raised.length, fmt: "int" }, { label: "Billed", value: r2(raised.reduce((n, b) => n + Number(b.total), 0)), fmt: "money" },
        { label: "Still unpaid", value: raised.filter((b) => b.status !== "Paid").length, fmt: "int" },
      ],
      note: "Worked out from the day's bills — there's no separate day-close snapshot to read.",
    };
  },
});

const unpaid = (b: BillRow) => b.status === "Pending" || b.status === "Partial";
const owed = (b: BillRow): number => r2(Number(b.patient_share ?? b.total));

// ─── Registers ───────────────────────────────────────────────────────────────

const opdVisitsIn = async (x: Ctx) => (await x.data.opd()).filter((v) => within(dayOf(v.created_at), x));

const opdRegister = (id: string, title: string, description: string, by: string, key: (v: OpdVisitRow, p: Map<number, PatientRow>, d: Map<number, DoctorRow>) => string): Def => ({
  id, title, category: "OPD / IPD registers", description, param: "range",
  run: async (x) => {
    const [visits, patients, doctors] = await Promise.all([opdVisitsIn(x), x.data.patients(), x.data.doctors()]);
    const pm = new Map(patients.map((p) => [p.id, p] as const)); const dm = new Map(doctors.map((d) => [d.id, d] as const));
    return grouped(visits, by, (v) => key(v, pm, dm));
  },
});

const ward = (a: IpdAdmissionRow) => a.ward || "Unassigned";

// ─── The catalogue ───────────────────────────────────────────────────────────

const CATALOGUE: Def[] = [
  // Cashier & collection
  dayBook("Day book - IPD", "daybook_ipd", "IPD receipts for a day with payment-mode subtotals.", ["IPD"]),
  dayBook("Day book - OPD", "daybook_opd", "OPD receipts for a day with payment-mode subtotals.", ["OPD"]),
  { id: "daybook_emergency", title: "Day book - Emergency", category: "Cashier & collection", description: "Emergency receipts for a day.", param: "day", why: "Bills aren't raised against an emergency department here." },
  dayBook("Day book - combined", "daybook_combined", "IPD + OPD + Emergency receipts for a day, merged.", ["IPD", "OPD"]),
  dayBookGrouped("daybook_mode", "Day book - payment-mode-wise", "A day's receipts grouped by payment mode.", "Payment mode", (b) => [b.payment_mode || "Not recorded"]),
  dayBookGrouped("daybook_head", "Day book - account-head-wise", "A day's receipts grouped by income account head.", "Account head", (b) => [`${b.type} income`]),
  dayBookGrouped("daybook_group", "Day book - group-wise", "A day's receipts grouped by service group.", "Service group", (b, g, items) => [...new Set((items.get(b.id) ?? []).map((i) => (i.service_id != null ? g.get(i.service_id) : null) ?? "Ungrouped"))].concat((items.get(b.id) ?? []).length ? [] : ["Ungrouped"])),
  closing("daybook_closing", "Day book - closing", "End-of-day closing totals from the day-close snapshot."),
  closing("daybook_closing_ipd", "Day book - closing (IPD)", "Day-close totals, IPD scope only.", ["IPD"]),
  {
    id: "collection", title: "Collection report", category: "Cashier & collection", description: "All receipts in a period, by payment mode.", param: "range",
    run: async (x) => grouped(settled(await x.data.bills(), x), "Payment mode", (b) => b.payment_mode || "Not recorded", received),
  },
  {
    id: "deposit", title: "Deposit report", category: "Cashier & collection", description: "Advances/deposits taken and their utilisations.", param: "range",
    run: async (x) => {
      const rows = (await x.data.ipd()).filter((a) => Number(a.deposit_amount) > 0 && within(a.admission_date, x)).map((a) => ({ date: a.admission_date, admission: a.admission_no ?? "", patient: a.patient_name, mode: a.deposit_mode || "Not recorded", amount: r2(Number(a.deposit_amount)) } as Row));
      return { ...table([c("date", "Date", "date"), c("admission", "Admission no."), c("patient", "Patient"), c("mode", "Mode"), c("amount", "Deposit", "money")], rows, ["amount"]), note: "Deposits are those taken when a patient is admitted." };
    },
  },
  {
    id: "refund", title: "Refund report", category: "Cashier & collection", description: "Refunds in a period by type and mode.", param: "range",
    run: async (x) => {
      const bills = (await x.data.bills()).filter((b) => b.status === "Refunded" && within(b.bill_date, x)).map((b) => ({ date: b.bill_date, ref: b.bill_number, patient: b.patient_name, type: `Bill refund · ${b.type}`, mode: b.payment_mode || "Not recorded", amount: r2(Number(b.total)) } as Row));
      const returns = (await x.data.returns()).filter((r) => within(dayOf(r.created_at), x)).map((r) => ({ date: dayOf(r.created_at), ref: r.credit_note_no, patient: r.medicine_name, type: "Pharmacy return", mode: "Credit note", amount: r2(Number(r.credit_value)) } as Row));
      return table([c("date", "Date", "date"), c("ref", "Reference"), c("patient", "Patient / item"), c("type", "Type"), c("mode", "Mode"), c("amount", "Amount", "money")], [...bills, ...returns].sort((a, b) => text(b.date).localeCompare(text(a.date))), ["amount"]);
    },
  },
  {
    id: "outstanding", title: "Outstanding / dues", category: "Cashier & collection", description: "Bills dated up to a date that are still unpaid (current balances, not point-in-time).", param: "asof",
    run: async (x) => {
      const rows = (await x.data.bills()).filter((b) => unpaid(b) && b.bill_date <= x.to).map((b) => ({ date: b.bill_date, bill: b.bill_number, patient: b.patient_name, type: b.type, status: b.status, due: owed(b) } as Row)).sort((a, b) => text(a.date).localeCompare(text(b.date)));
      return table([c("date", "Bill date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("type", "Type"), c("status", "Status"), c("due", "Due", "money")], rows, ["due"]);
    },
  },
  {
    id: "patient_ledger", title: "Patient ledger", category: "Cashier & collection", description: "One patient's chronological debits/credits with running balance.", param: "patient",
    run: async (x) => {
      const q = x.q.trim().toLowerCase();
      if (!q) return { columns: [], rows: [], note: "Type a patient's name or code to see their ledger." };
      const patients = (await x.data.patients()).filter((p) => p.name.toLowerCase().includes(q) || p.patient_code.toLowerCase() === q);
      if (!patients.length) return { columns: [], rows: [], note: "No patient matches that." };
      if (patients.length > 1) return { columns: [c("name", "Patient"), c("code", "Code")], rows: patients.slice(0, 20).map((p) => ({ name: p.name, code: p.patient_code })), note: "More than one patient matches — use the patient code." };
      const [p] = patients;
      const bills = (await x.data.bills()).filter((b) => b.patient_id === p.id).sort((a, b) => a.bill_date.localeCompare(b.bill_date) || a.id - b.id);
      let balance = 0;
      const rows: Row[] = [];
      for (const b of bills) {
        balance += owed(b); rows.push({ date: b.bill_date, ref: b.bill_number, detail: `${b.type} bill`, debit: owed(b), credit: 0, balance: r2(balance) });
        if (b.status === "Paid") { balance -= owed(b); rows.push({ date: b.bill_date, ref: b.bill_number, detail: `Paid${b.payment_mode ? ` · ${b.payment_mode}` : ""}`, debit: 0, credit: owed(b), balance: r2(balance) }); }
      }
      return { ...table([c("date", "Date", "date"), c("ref", "Reference"), c("detail", "Detail"), c("debit", "Debit", "money"), c("credit", "Credit", "money"), c("balance", "Balance", "money")], rows, ["debit", "credit"]), summary: [{ label: "Patient", value: `${p.name} · ${p.patient_code}` }, { label: "Balance due", value: r2(balance), fmt: "money" }] };
    },
  },
  { id: "operator_wise", title: "Operator-wise collection", category: "Cashier & collection", description: "Per-cashier collection breakdown.", param: "range", why: "Bills don't record which cashier took the payment." },
  { id: "tds_payments", title: "TDS on payments", category: "Cashier & collection", description: "TDS deducted on payments in a period.", param: "range", why: "Payments don't record TDS." },
  {
    id: "gst_collection", title: "GST collection", category: "Cashier & collection", description: "CGST/SGST/IGST collected in a period.", param: "range",
    run: async (x) => {
      const bills = settled(await x.data.bills(), x);
      const ids = new Set(bills.map((b) => b.id));
      const items = (await x.data.items()).filter((i) => ids.has(i.bill_id));
      const itemised = new Set(items.map((i) => i.bill_id));
      const rows = [...group(items.filter((i) => Number(i.gst_rate) > 0), (i) => String(i.gst_rate))].map(([rate, list]) => {
        const taxable = r2(list.reduce((n, i) => n + Number(i.amount), 0)); const tax = r2(taxable * (Number(rate) / 100));
        return { rate: `${rate}%`, taxable, cgst: r2(tax / 2), sgst: r2(tax / 2), igst: 0, tax } as Row;
      });
      // Older bills carry only a GST total, not the lines it came from.
      const plain = bills.filter((b) => !itemised.has(b.id) && Number(b.gst) > 0);
      if (plain.length) {
        const tax = r2(plain.reduce((n, b) => n + Number(b.gst), 0));
        rows.push({ rate: "Bill total only", taxable: r2(plain.reduce((n, b) => n + Number(b.amount) - Number(b.discount), 0)), cgst: r2(tax / 2), sgst: r2(tax / 2), igst: 0, tax });
      }
      return { ...table([c("rate", "GST rate"), c("taxable", "Taxable value", "money"), c("cgst", "CGST", "money"), c("sgst", "SGST", "money"), c("igst", "IGST", "money"), c("tax", "Total tax", "money")], rows, ["taxable", "cgst", "sgst", "igst", "tax"]), note: "Treated as within-state supply (CGST + SGST). Bills without line items show their GST total only." };
    },
  },
  { id: "instrument_date", title: "Instrument-date-wise", category: "Cashier & collection", description: "Cheque/DD receipts tracked by instrument date.", param: "range", why: "Cheque and DD details aren't recorded with a payment." },
  {
    id: "receivables_aging", title: "Receivables aging", category: "Cashier & collection", description: "Unpaid bill balances today, by how long they have been outstanding.", param: "none",
    run: async (x) => {
      const buckets = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, Infinity]] as const;
      const open = (await x.data.bills()).filter(unpaid);
      const rows = buckets.map(([name, lo, hi]) => { const list = open.filter((b) => { const d = daysBetween(b.bill_date, x.today); return d >= lo && d <= hi; }); return { name, count: list.length, amount: r2(list.reduce((n, b) => n + owed(b), 0)) } as Row; });
      return table([c("name", "Outstanding for"), c("count", "Bills", "int"), c("amount", "Balance", "money")], rows, ["count", "amount"]);
    },
  },

  // Billing & revenue
  {
    id: "bill_summary", title: "Bill report - summary", category: "Billing & revenue", description: "One row per bill with totals.", param: "range",
    run: async (x) => table([c("date", "Date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("type", "Type"), c("amount", "Charges", "money"), c("discount", "Discount", "money"), c("gst", "GST", "money"), c("total", "Total", "money"), c("status", "Status")],
      (await x.data.bills()).filter((b) => within(b.bill_date, x)).map((b) => ({ date: b.bill_date, bill: b.bill_number, patient: b.patient_name, type: b.type, amount: Number(b.amount), discount: Number(b.discount), gst: Number(b.gst), total: Number(b.total), status: b.status } as Row)), ["amount", "discount", "gst", "total"]),
  },
  {
    id: "bill_detail", title: "Bill report - detail", category: "Billing & revenue", description: "Line-item level billing detail.", param: "range",
    run: async (x) => {
      const bills = new Map((await x.data.bills()).filter((b) => within(b.bill_date, x)).map((b) => [b.id, b] as const));
      const rows = (await x.data.items()).filter((i) => bills.has(i.bill_id)).map((i) => { const b = bills.get(i.bill_id)!; return { date: b.bill_date, bill: b.bill_number, patient: b.patient_name, item: i.name, qty: Number(i.quantity), rate: Number(i.unit_price), amount: Number(i.amount) } as Row; });
      return table([c("date", "Date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("item", "Item"), c("qty", "Qty", "int"), c("rate", "Rate", "money"), c("amount", "Amount", "money")], rows, ["qty", "amount"]);
    },
  },
  {
    id: "consulting_doctor_revenue", title: "Consulting-doctor-wise revenue", category: "Billing & revenue", description: "Revenue grouped by consulting doctor.", param: "range",
    run: async (x) => grouped((await x.data.bills()).filter((b) => within(b.bill_date, x)), "Doctor", (b) => b.doctor_name || "No doctor on bill", (b) => Number(b.total)),
  },
  {
    id: "referred_doctor_revenue", title: "Referred-doctor-wise revenue", category: "Billing & revenue", description: "Revenue grouped by referring doctor.", param: "range",
    run: async (x) => {
      const pm = new Map((await x.data.patients()).map((p) => [p.id, p] as const));
      return grouped((await x.data.bills()).filter((b) => within(b.bill_date, x)), "Referred by", (b) => (b.patient_id != null ? pm.get(b.patient_id)?.referral_source : "") || "Not referred", (b) => Number(b.total));
    },
  },
  {
    id: "item_revenue", title: "Item-wise revenue", category: "Billing & revenue", description: "Revenue per service/item.", param: "range",
    run: async (x) => {
      const ids = new Set((await x.data.bills()).filter((b) => within(b.bill_date, x)).map((b) => b.id));
      const lines = (await x.data.items()).filter((i) => ids.has(i.bill_id));
      const out = [...group(lines, (i) => i.name)].map(([name, list]) => ({ name, qty: list.reduce((n, i) => n + Number(i.quantity), 0), amount: r2(list.reduce((n, i) => n + Number(i.amount), 0)) } as Row)).sort((a, b) => Number(b.amount) - Number(a.amount));
      return table([c("name", "Item"), c("qty", "Quantity", "int"), c("amount", "Revenue", "money")], out, ["qty", "amount"]);
    },
  },
  {
    id: "discount", title: "Discount report", category: "Billing & revenue", description: "Discounts with authorizer and reason.", param: "range",
    run: async (x) => ({
      ...table([c("date", "Date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("amount", "Charges", "money"), c("discount", "Discount", "money"), c("pct", "Discount %", "pct")],
        (await x.data.bills()).filter((b) => within(b.bill_date, x) && Number(b.discount) > 0).map((b) => ({ date: b.bill_date, bill: b.bill_number, patient: b.patient_name, amount: Number(b.amount), discount: Number(b.discount), pct: Number(b.amount) > 0 ? r2((Number(b.discount) / Number(b.amount)) * 100) : 0 } as Row)), ["amount", "discount"]),
      note: "Bills don't record who authorised a discount or why, so those columns aren't shown.",
    }),
  },
  {
    id: "transaction_discount", title: "Transaction-discount report", category: "Billing & revenue", description: "Transaction-level discounts.", param: "range",
    run: async (x) => grouped((await x.data.bills()).filter((b) => within(b.bill_date, x) && Number(b.discount) > 0), "Bill type", (b) => b.type, (b) => Number(b.discount)),
  },
  { id: "all_cancellations", title: "All cancellations", category: "Billing & revenue", description: "All item and bill cancellations.", param: "range", why: "A bill can be refunded but isn't cancelled or voided here." },
  { id: "bill_cancellations", title: "Bill cancellations", category: "Billing & revenue", description: "Whole-bill cancellations only.", param: "range", why: "A bill can be refunded but isn't cancelled or voided here." },
  { id: "package_revenue", title: "Package-wise revenue", category: "Billing & revenue", description: "Revenue by package with sessions used vs remaining.", param: "range", why: "Package sessions aren't tracked against bills." },
  {
    id: "account_head_revenue", title: "Account-head-wise revenue", category: "Billing & revenue", description: "Revenue mapped to income account heads.", param: "range",
    run: async (x) => grouped((await x.data.bills()).filter((b) => within(b.bill_date, x)), "Account head", (b) => `${b.type} income`, (b) => Number(b.total)),
  },
  {
    id: "group_comprehensive", title: "Group-wise comprehensive", category: "Billing & revenue", description: "Service-group revenue with the GST split.", param: "range",
    run: async (x) => {
      const ids = new Set((await x.data.bills()).filter((b) => within(b.bill_date, x)).map((b) => b.id)); const groups = await x.data.serviceGroups();
      const rows = [...group((await x.data.items()).filter((i) => ids.has(i.bill_id)), (i) => (i.service_id != null ? groups.get(i.service_id) : null) ?? "Ungrouped")].map(([name, list]) => {
        const amount = r2(list.reduce((n, i) => n + Number(i.amount), 0)); const gst = r2(list.reduce((n, i) => n + Number(i.amount) * (Number(i.gst_rate) / 100), 0));
        return { name, amount, gst, total: r2(amount + gst) } as Row;
      }).sort((a, b) => Number(b.total) - Number(a.total));
      return table([c("name", "Service group"), c("amount", "Revenue", "money"), c("gst", "GST", "money"), c("total", "With GST", "money")], rows, ["amount", "gst", "total"]);
    },
  },
  {
    id: "registration_fee", title: "Registration-fee collection", category: "Billing & revenue", description: "Registration and visit charges collected.", param: "range",
    run: async (x) => {
      const bills = new Map((await x.data.bills()).filter((b) => within(b.bill_date, x)).map((b) => [b.id, b] as const));
      return table([c("date", "Date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("item", "Charge"), c("amount", "Amount", "money")],
        (await x.data.items()).filter((i) => bills.has(i.bill_id) && /registration|visit|consult/i.test(i.name)).map((i) => { const b = bills.get(i.bill_id)!; return { date: b.bill_date, bill: b.bill_number, patient: b.patient_name, item: i.name, amount: Number(i.amount) } as Row; }), ["amount"]);
    },
  },

  // OPD / IPD registers
  {
    id: "opd_new", title: "OPD register - new patients", category: "OPD / IPD registers", description: "First-ever visits only.", param: "range",
    run: async (x) => table(VISIT_COLS, (await firstVisits(x, true)).map(visitRow)),
  },
  {
    id: "opd_revisit", title: "OPD register - revisit", category: "OPD / IPD registers", description: "Revisit visits.", param: "range",
    run: async (x) => table(VISIT_COLS, (await firstVisits(x, false)).map(visitRow)),
  },
  {
    id: "opd_token", title: "OPD register - token-wise", category: "OPD / IPD registers", description: "A day's visits ordered by token.", param: "day",
    run: async (x) => table([c("token", "Token"), c("time", "Checked in"), c("patient", "Patient"), c("doctor", "Doctor"), c("reason", "Reason"), c("status", "Status")],
      (await x.data.opd()).filter((v) => dayOf(v.created_at) === x.from).sort((a, b) => a.token_number.localeCompare(b.token_number, undefined, { numeric: true })).map((v) => ({ token: v.token_number, time: v.check_in_time, patient: v.patient_name, doctor: v.doctor, reason: v.reason, status: v.status } as Row))),
  },
  opdRegister("opd_dept", "OPD register - department-wise", "Footfall per department.", "Department", (v, _p, d) => (v.doctor_id != null ? d.get(v.doctor_id)?.department : "") || "Unassigned"),
  opdRegister("opd_org", "OPD register - organization-wise", "Corporate/sponsor organisation visits.", "Organisation", (v, p) => (v.patient_id != null ? p.get(v.patient_id)?.corporate : "") || "Self / none"),
  opdRegister("opd_tpa", "OPD register - TPA-wise", "TPA patient visits.", "Insurer / TPA", (v, p) => (v.patient_id != null ? p.get(v.patient_id)?.insurer : "") || "No TPA"),
  opdRegister("opd_arrival", "OPD register - status on arrival", "Visits grouped by arrival status.", "Priority on arrival", (v) => v.priority || "Routine"),
  {
    id: "ipd_ward", title: "IPD register - ward-wise", category: "OPD / IPD registers", description: "Admissions per ward.", param: "range",
    run: async (x) => grouped((await x.data.ipd()).filter((a) => within(a.admission_date, x)), "Ward", ward),
  },
  {
    id: "ipd_patient_type", title: "IPD register - patient-type", category: "OPD / IPD registers", description: "Admissions grouped by payer class.", param: "range",
    run: async (x) => {
      const pm = new Map((await x.data.patients()).map((p) => [p.id, p] as const));
      return grouped((await x.data.ipd()).filter((a) => within(a.admission_date, x)), "Patient type", (a) => (a.patient_id != null ? pm.get(a.patient_id)?.patient_category : "") || "General");
    },
  },
  {
    id: "ipd_combination", title: "IPD register - combination", category: "OPD / IPD registers", description: "Multi-axis admission register.", param: "range",
    run: async (x) => table([c("date", "Admitted", "date"), c("admission", "Admission no."), c("patient", "Patient"), c("ward", "Ward"), c("type", "Type"), c("doctor", "Doctor"), c("status", "Status")],
      (await x.data.ipd()).filter((a) => within(a.admission_date, x)).map((a) => ({ date: a.admission_date, admission: a.admission_no ?? "", patient: a.patient_name, ward: ward(a), type: a.admission_type || "—", doctor: a.doctor, status: a.status } as Row))),
  },
  {
    id: "bed_occupancy", title: "Bed occupancy", category: "OPD / IPD registers", description: "Bed days used vs available over a period.", param: "range",
    run: async (x) => {
      const [beds, ipd] = await Promise.all([x.data.beds(), x.data.ipd()]); const days = Math.max(1, daysBetween(x.from, x.to) + 1);
      const rows = [...group(beds, (b) => b.ward)].map(([name, list]) => {
        const used = ipd.filter((a) => (a.ward || "") === name).reduce((n, a) => { const from = a.admission_date > x.from ? a.admission_date : x.from; const to = a.status === "Discharged" ? (dayOf(a.updated_at) < x.to ? dayOf(a.updated_at) : x.to) : x.to; return n + Math.max(0, daysBetween(from, to) + 1); }, 0);
        const available = list.length * days;
        return { name, beds: list.length, available, used: Math.min(used, available), pct: available ? Math.round((Math.min(used, available) / available) * 100) : 0 } as Row;
      });
      return { ...table([c("name", "Ward"), c("beds", "Beds", "int"), c("available", "Bed days available", "int"), c("used", "Bed days used", "int"), c("pct", "Occupancy", "pct")], rows, ["beds", "available", "used"]), note: "Bed days are counted from admission and discharge dates." };
    },
  },
  {
    id: "occupancy_closing", title: "Occupancy - closing register", category: "OPD / IPD registers", description: "Beds occupied at midnight (snapshot).", param: "none",
    run: async (x) => table([c("name", "Ward"), c("beds", "Beds", "int"), c("occupied", "Occupied", "int"), c("available", "Available", "int")],
      [...group(await x.data.beds(), (b) => b.ward)].map(([name, list]) => ({ name, beds: list.length, occupied: list.filter((b) => b.status === "Occupied").length, available: list.filter((b) => b.status === "Available").length } as Row)), ["beds", "occupied", "available"]),
  },
  {
    id: "occupancy_dept", title: "Occupancy - department-wise", category: "OPD / IPD registers", description: "Bed count by department on a date.", param: "none",
    run: async (x) => {
      const dm = new Map((await x.data.doctors()).map((d) => [d.id, d.department || d.specialty] as const));
      return grouped((await x.data.ipd()).filter((a) => a.status !== "Discharged"), "Department", (a) => (a.doctor_id != null ? dm.get(a.doctor_id) : "") || "Unassigned");
    },
  },
  {
    id: "ward_bed_count", title: "Ward-wise bed count", category: "OPD / IPD registers", description: "Total/occupied/available per ward.", param: "none",
    run: async (x) => table([c("name", "Ward"), c("beds", "Total", "int"), c("occupied", "Occupied", "int"), c("available", "Available", "int")],
      [...group(await x.data.beds(), (b) => b.ward)].map(([name, list]) => ({ name, beds: list.length, occupied: list.filter((b) => b.status === "Occupied").length, available: list.filter((b) => b.status === "Available").length } as Row)), ["beds", "occupied", "available"]),
  },
  {
    id: "ipd_deposit", title: "IPD deposit report", category: "OPD / IPD registers", description: "Deposits taken for IPD admissions.", param: "range",
    run: async (x) => table([c("date", "Admitted", "date"), c("admission", "Admission no."), c("patient", "Patient"), c("mode", "Mode"), c("amount", "Deposit", "money")],
      (await x.data.ipd()).filter((a) => Number(a.deposit_amount) > 0 && within(a.admission_date, x)).map((a) => ({ date: a.admission_date, admission: a.admission_no ?? "", patient: a.patient_name, mode: a.deposit_mode || "Not recorded", amount: r2(Number(a.deposit_amount)) } as Row)), ["amount"]),
  },
  {
    id: "ipd_refund", title: "IPD refund report", category: "OPD / IPD registers", description: "Refunds for IPD patients.", param: "range",
    run: async (x) => table([c("date", "Date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("mode", "Mode"), c("amount", "Amount", "money")],
      (await x.data.bills()).filter((b) => b.type === "IPD" && b.status === "Refunded" && within(b.bill_date, x)).map((b) => ({ date: b.bill_date, bill: b.bill_number, patient: b.patient_name, mode: b.payment_mode || "Not recorded", amount: r2(Number(b.total)) } as Row)), ["amount"]),
  },
  {
    id: "admit_discharge", title: "Admitted / discharged register", category: "OPD / IPD registers", description: "Combined admission and discharge register.", param: "range",
    run: async (x) => {
      const rows: Row[] = [];
      for (const a of await x.data.ipd()) {
        if (within(a.admission_date, x)) rows.push({ date: a.admission_date, event: "Admitted", admission: a.admission_no ?? "", patient: a.patient_name, ward: ward(a), doctor: a.doctor });
        if (a.status === "Discharged" && within(dayOf(a.updated_at), x)) rows.push({ date: dayOf(a.updated_at), event: "Discharged", admission: a.admission_no ?? "", patient: a.patient_name, ward: ward(a), doctor: a.doctor });
      }
      return table([c("date", "Date", "date"), c("event", "Event"), c("admission", "Admission no."), c("patient", "Patient"), c("ward", "Ward"), c("doctor", "Doctor")], rows.sort((a, b) => text(a.date).localeCompare(text(b.date))));
    },
  },
  {
    id: "surgery_register", title: "Surgery register", category: "OPD / IPD registers", description: "OT cases with surgeon, anaesthetist and times.", param: "range",
    run: async (x) => table([c("date", "Date", "date"), c("time", "Time"), c("patient", "Patient"), c("procedure", "Procedure"), c("room", "OT room"), c("surgeon", "Surgeon"), c("anaesthetist", "Anaesthetist"), c("status", "Status")],
      (await x.data.ot()).filter((o) => within(o.scheduled_date, x)).map((o) => ({ date: o.scheduled_date, time: o.scheduled_time, patient: o.patient_name, procedure: o.surgery_name || o.procedure, room: o.ot_room, surgeon: o.surgeon, anaesthetist: o.anesthetist, status: o.status } as Row))),
  },
  {
    id: "room_shifting", title: "Room-shifting report", category: "OPD / IPD registers", description: "Bed transfers with reason and rate change.", param: "range",
    run: async (x) => ({ ...table([c("date", "Date", "date"), c("patient", "Patient"), c("from", "From"), c("to", "To"), c("reason", "Reason")],
      (await x.data.transfers()).filter((t) => within(t.transfer_date, x)).map((t) => ({ date: t.transfer_date, patient: t.patient_name, from: t.from_label, to: t.to_label, reason: t.reason } as Row))), note: "The rate change isn't recorded with a transfer." }),
  },
  {
    id: "opd_footfall", title: "OPD footfall by day", category: "OPD / IPD registers", description: "Appointments per day: arrived, completed, no-shows and the no-show rate.", param: "range",
    run: async (x) => {
      const visits = await x.data.opd();
      const came = (a: AppointmentRow) => visits.some((v) => dayOf(v.created_at) === a.appointment_date && (a.patient_id != null ? v.patient_id === a.patient_id : v.patient_name === a.patient_name));
      const rows = [...group((await x.data.appts()).filter((a) => within(a.appointment_date, x) && a.status !== "Cancelled"), (a) => a.appointment_date)].sort().map(([date, list]) => {
        const arrived = list.filter((a) => a.status === "Completed" || came(a)).length;
        const noShow = date < x.today ? list.length - arrived : 0;
        return { date, booked: list.length, arrived, completed: list.filter((a) => a.status === "Completed").length, noShow, rate: list.length ? Math.round((noShow / list.length) * 100) : 0 } as Row;
      });
      return { ...table([c("date", "Date", "date"), c("booked", "Booked", "int"), c("arrived", "Arrived", "int"), c("completed", "Completed", "int"), c("noShow", "No-show", "int"), c("rate", "No-show rate", "pct")], rows, ["booked", "arrived", "completed", "noShow"]), note: "Cancelled appointments are left out; a no-show is a booking on a past day with no visit." };
    },
  },
  {
    id: "admissions_by_day", title: "Admissions by day", category: "OPD / IPD registers", description: "Admissions per day, how many have been discharged, and their average length of stay.", param: "range",
    run: async (x) => {
      const rows = [...group((await x.data.ipd()).filter((a) => within(a.admission_date, x)), (a) => a.admission_date)].sort().map(([date, list]) => {
        const out = list.filter((a) => a.status === "Discharged"); const stays = out.map((a) => Math.max(1, daysBetween(a.admission_date, dayOf(a.updated_at))));
        return { date, admitted: list.length, discharged: out.length, los: stays.length ? r2(stays.reduce((n, d) => n + d, 0) / stays.length) : null } as Row;
      });
      return table([c("date", "Date", "date"), c("admitted", "Admitted", "int"), c("discharged", "Discharged", "int"), c("los", "Avg stay (days)")], rows, ["admitted", "discharged"]);
    },
  },

  // Clinical & diagnostic
  {
    id: "mlc_register", title: "MLC register", category: "Clinical & diagnostic", description: "Medico-legal cases - statutory, printed as entered.", param: "range",
    run: async (x) => {
      const pm = new Map((await x.data.patients()).map((p) => [p.id, p] as const));
      return table([c("date", "Admitted", "date"), c("admission", "Admission no."), c("patient", "Patient"), c("age", "Age", "int"), c("doctor", "Doctor"), c("diagnosis", "Diagnosis")],
        (await x.data.ipd()).filter((a) => within(a.admission_date, x) && (a.is_mlc || (a.patient_id != null && pm.get(a.patient_id)?.medico_legal))).map((a) => ({ date: a.admission_date, admission: a.admission_no ?? "", patient: a.patient_name, age: a.patient_age, doctor: a.doctor, diagnosis: a.diagnosis } as Row)));
    },
  },
  {
    id: "birth_register", title: "Birth / delivery register", category: "Clinical & diagnostic", description: "Births - statutory, printed as entered.", param: "range",
    run: async (x) => table([c("date", "Date", "date"), c("time", "Time"), c("child", "Child"), c("gender", "Gender"), c("weight", "Weight (kg)"), c("mother", "Mother"), c("father", "Father")],
      (await x.data.births()).filter((b) => within(b.birth_date, x)).map((b) => ({ date: b.birth_date, time: b.birth_time, child: b.child_name, gender: b.gender, weight: Number(b.weight_kg), mother: b.mother_name, father: b.father_name } as Row))),
  },
  { id: "incident_register", title: "Incident register", category: "Clinical & diagnostic", description: "Falls, medication errors, near-misses - the M12 register (submitted reports; reporter never printed).", param: "range", why: "Incident reports aren't captured in this system yet." },
  { id: "er_audit", title: "ER case-paper audit", category: "Clinical & diagnostic", description: "ER registrations with MLC flag and disposition.", param: "range", why: "There is no emergency registration to audit." },
  { id: "doctor_assessment", title: "Doctor initial-assessment register", category: "Clinical & diagnostic", description: "Initial assessments done vs pending.", param: "range", why: "Initial assessments aren't recorded as a separate form." },
  { id: "nursing_assessment", title: "Nursing initial-assessment register", category: "Clinical & diagnostic", description: "Nursing assessments done vs pending.", param: "range", why: "Nursing assessments aren't recorded as a separate form." },
  {
    id: "lab_workflow", title: "Lab workflow", category: "Clinical & diagnostic", description: "Ordered → collected → resulted → dispatched funnel.", param: "range",
    run: async (x) => {
      const labs = (await x.data.labs()).filter((l) => within(l.test_date, x));
      const rows: Row[] = [
        { name: "Ordered", count: labs.length }, { name: "Sample collected", count: labs.filter((l) => !/pending|not/i.test(l.sample_status)).length },
        { name: "Resulted", count: labs.filter((l) => !!l.report_file || /ready|complete|done/i.test(l.report_status)).length }, { name: "Report uploaded", count: labs.filter((l) => !!l.report_file).length },
      ];
      return { ...table([c("name", "Stage"), c("count", "Tests", "int")], rows), note: "Dispatch (emailed / printed) isn't recorded, so the funnel ends at the uploaded report." };
    },
  },
  {
    id: "lab_audit", title: "Lab audit", category: "Clinical & diagnostic", description: "Who entered or amended which results.", param: "range",
    run: async (x) => ({ ...table([c("date", "Uploaded", "date"), c("order", "Order"), c("patient", "Patient"), c("test", "Test"), c("by", "Uploaded by")],
      (await x.data.labs()).filter((l) => l.report_uploaded_at && within(dayOf(l.report_uploaded_at), x)).map((l) => ({ date: dayOf(l.report_uploaded_at), order: l.order_number, patient: l.patient_name, test: l.test_name, by: l.report_uploaded_by || "—" } as Row))), note: "Shows who uploaded each result; amendments aren't versioned." }),
  },
  { id: "lab_verification", title: "Lab authentication / verification", category: "Clinical & diagnostic", description: "Results verified by whom and when.", param: "range", why: "Results aren't verified as a separate step." },
  { id: "lab_delta", title: "Lab delta-check", category: "Clinical & diagnostic", description: "Results flagged against the previous value.", param: "range", why: "Results are stored as report files, not values to compare." },
  { id: "lab_dispatch", title: "Lab dispatch register", category: "Clinical & diagnostic", description: "Reports dispatched (email/printed).", param: "range", why: "Dispatch of a report isn't recorded." },
  {
    id: "radiology_workflow", title: "Radiology workflow", category: "Clinical & diagnostic", description: "Ordered → reported → published funnel.", param: "range",
    run: async (x) => {
      const rads = (await x.data.rads()).filter((r) => within(r.test_date, x));
      return table([c("name", "Stage"), c("count", "Studies", "int")], [
        { name: "Ordered", count: rads.length }, { name: "Scanned", count: rads.filter((r) => !/pending|not/i.test(r.scan_status)).length }, { name: "Reported", count: rads.filter((r) => !!r.report_file).length },
      ]);
    },
  },
  {
    id: "diagnosis_report", title: "Diagnosis report", category: "Clinical & diagnostic", description: "ICD-10 diagnosis frequency.", param: "range",
    run: async (x) => ({ ...grouped((await x.data.ipd()).filter((a) => within(a.admission_date, x) && a.diagnosis.trim()), "Diagnosis", (a) => a.diagnosis.trim()), note: "From admission diagnoses as typed; they aren't coded to ICD-10 at entry." }),
  },
  { id: "certificate_register", title: "Certificate-issue register", category: "Clinical & diagnostic", description: "Certificates issued - statutory.", param: "range", why: "Certificates aren't issued from this system yet." },
  { id: "mtp_register", title: "MTP register", category: "Clinical & diagnostic", description: "Medical termination of pregnancy - statutory.", param: "range", why: "MTP cases aren't recorded in this system." },

  // Accounts & statutory
  ...(["IPD", "OPD"] as const).flatMap((kind): Def[] => [
    payoutReport(`fee_consulting_${kind.toLowerCase()}`, `Professional fee - consulting (${kind})`, `Gross/TDS/net per consulting doctor, ${kind}.`, kind, ["Consulting"]),
    payoutReport(`fee_referred_${kind.toLowerCase()}`, `Professional fee - referred (${kind})`, `Referral payouts, ${kind}.`, kind, ["Referred"]),
  ]),
  payoutReport("fee_surgeon", "Professional fee - surgeon (package)", "Package-level surgeon share.", null, ["Surgeon"]),
  { id: "payout_adjustments", title: "Payout adjustments register", category: "Accounts & statutory", description: "Manual adjustments to accruals.", param: "range", why: "Payouts can't be manually adjusted." },
  { id: "tds_register", title: "TDS register", category: "Accounts & statutory", description: "TDS deducted on payouts and payments (26Q columns).", param: "range", why: "TDS isn't deducted or recorded." },
  { id: "tcs_register", title: "TCS register", category: "Accounts & statutory", description: "TCS collected on large bills.", param: "range", why: "TCS isn't collected or recorded." },
  gstReport("opd_gst", "OPD GST report", "CGST/SGST/IGST on OPD bills.", "OPD"),
  gstReport("ipd_gst", "IPD GST report", "CGST/SGST/IGST on IPD bills.", "IPD"),
  {
    id: "gstr1", title: "GSTR-1 (HSN summary)", category: "Accounts & statutory", description: "HSN/SAC-wise taxable value + CGST/SGST/IGST for the GST return.", param: "range",
    run: async (x) => {
      const ids = new Set((await x.data.bills()).filter((b) => within(b.bill_date, x)).map((b) => b.id));
      const rows = [...group((await x.data.items()).filter((i) => ids.has(i.bill_id) && Number(i.gst_rate) > 0), (i) => `${i.hsn_sac || "—"}|${i.gst_rate}`)].map(([k, list]) => {
        const [hsn, rate] = k.split("|"); const taxable = r2(list.reduce((n, i) => n + Number(i.amount), 0)); const tax = r2(taxable * (Number(rate) / 100));
        return { hsn, rate: `${rate}%`, qty: list.reduce((n, i) => n + Number(i.quantity), 0), taxable, cgst: r2(tax / 2), sgst: r2(tax / 2), igst: 0 } as Row;
      }).sort((a, b) => text(a.hsn).localeCompare(text(b.hsn)));
      return { ...table([c("hsn", "HSN / SAC"), c("rate", "Rate"), c("qty", "Quantity", "int"), c("taxable", "Taxable value", "money"), c("cgst", "CGST", "money"), c("sgst", "SGST", "money"), c("igst", "IGST", "money")], rows, ["qty", "taxable", "cgst", "sgst", "igst"]), note: "Within-state supply assumed (CGST + SGST)." };
    },
  },
  { id: "gstr2b", title: "GSTR-2B (purchase ITC)", category: "Accounts & statutory", description: "Invoice-wise input GST on purchases for Input Tax Credit.", param: "range", why: "Purchase orders don't record the GST paid." },
  {
    id: "revenue_sharing", title: "Revenue-sharing report", category: "Accounts & statutory", description: "Contractor / IPF percentage allocations.", param: "range",
    run: async (x) => grouped((await x.data.payouts()).filter((p) => within(p.bill_date, x)), "Payout rule", (p) => p.rule_name, (p) => Number(p.amount)),
  },
  {
    id: "sales_trend", title: "Sales graph - trend", category: "Accounts & statutory", description: "Revenue trend by day/week/month.", param: "range",
    run: async (x) => table([c("name", "Date", "date"), c("count", "Bills", "int"), c("amount", "Revenue", "money")],
      [...group((await x.data.bills()).filter((b) => within(b.bill_date, x)), (b) => b.bill_date)].sort().map(([name, list]) => ({ name, count: list.length, amount: r2(list.reduce((n, b) => n + Number(b.total), 0)) } as Row)), ["count", "amount"]),
  },
  {
    id: "sales_dept", title: "Sales graph - by department", category: "Accounts & statutory", description: "Revenue by department (service-group proxy).", param: "range",
    run: async (x) => {
      const dm = new Map((await x.data.doctors()).map((d) => [d.id, d.department || d.specialty] as const));
      return grouped((await x.data.bills()).filter((b) => within(b.bill_date, x)), "Department", (b) => (b.doctor_id != null ? dm.get(b.doctor_id) : "") || `${b.type} (no doctor)`, (b) => Number(b.total));
    },
  },
  {
    id: "sales_doctor", title: "Sales graph - by doctor", category: "Accounts & statutory", description: "Revenue by doctor, ranked.", param: "range",
    run: async (x) => grouped((await x.data.bills()).filter((b) => within(b.bill_date, x) && b.doctor_name), "Doctor", (b) => b.doctor_name!, (b) => Number(b.total)),
  },
  {
    id: "income_head", title: "Income-head-wise report", category: "Accounts & statutory", description: "Revenue mapped to income heads.", param: "range",
    run: async (x) => {
      const billed = [...group((await x.data.bills()).filter((b) => within(b.bill_date, x)), (b) => `${b.type} income`)].map(([name, list]) => ({ name, count: list.length, amount: r2(list.reduce((n, b) => n + Number(b.total), 0)) } as Row));
      const other = [...group((await x.data.incomes()).filter((i) => within(i.entry_date, x)), (i) => i.category)].map(([name, list]) => ({ name: `${name} (other income)`, count: list.length, amount: r2(list.reduce((n, i) => n + Number(i.amount), 0)) } as Row));
      return table([c("name", "Income head"), c("count", "Entries", "int"), c("amount", "Amount", "money")], [...billed, ...other], ["count", "amount"]);
    },
  },
  {
    id: "indigent_register", title: "Indigent register", category: "Accounts & statutory", description: "Indigent patients - statutory.", param: "none",
    run: async (x) => incomeGroup(x, /indigent|bpl|below poverty/i),
  },
  {
    id: "weaker_section", title: "Weaker-section register", category: "Accounts & statutory", description: "Weaker-section patients - statutory.", param: "none",
    run: async (x) => incomeGroup(x, /weaker|ews|low/i),
  },
  {
    id: "expense_register", title: "Expense register", category: "Accounts & statutory", description: "Approved and posted expense vouchers in the range, with category, payee and payment mode.", param: "range",
    run: async (x) => ({ ...table([c("date", "Date", "date"), c("voucher", "Voucher"), c("category", "Category"), c("description", "Description"), c("amount", "Amount", "money")],
      (await x.data.expenses()).filter((e) => within(e.entry_date, x)).map((e) => ({ date: e.entry_date, voucher: e.invoice_number, category: e.category, description: e.description, amount: Number(e.amount) } as Row)), ["amount"]), note: "Payee and payment mode aren't recorded on an expense." }),
  },

  // Patient retention
  {
    id: "new_vs_returning", title: "New vs returning patients", category: "Patient retention", description: "Patients registered in the period against those who came back.", param: "range",
    run: async (x) => {
      const patients = await x.data.patients(); const visits = await patientVisitDays(x);
      const seen = [...visits].filter(([, days]) => days.some((d) => within(d, x)));
      const fresh = seen.filter(([id]) => { const p = patients.find((q) => q.id === id); return p ? within(p.visit_date, x) : false; }).length;
      return table([c("name", "Patients seen"), c("count", "Count", "int")], [{ name: "New (registered in the period)", count: fresh }, { name: "Returning", count: seen.length - fresh }]);
    },
  },
  {
    id: "lapsed_patients", title: "Lapsed patients", category: "Patient retention", description: "Patients with no visit in the last six months.", param: "asof",
    run: async (x) => {
      const cutoff = addDays(x.to, -182); const visits = await patientVisitDays(x);
      const rows = (await x.data.patients()).map((p) => { const days = visits.get(p.id) ?? []; const last = [days.reduce((m, d) => (d > m ? d : m), ""), p.visit_date].filter(Boolean).sort().pop() ?? ""; return { code: p.patient_code, name: p.name, phone: p.phone, last, since: last ? daysBetween(last, x.to) : null } as Row; })
        .filter((r) => text(r.last) && text(r.last) < cutoff).sort((a, b) => text(a.last).localeCompare(text(b.last)));
      return table([c("code", "Code"), c("name", "Patient"), c("phone", "Phone"), c("last", "Last visit", "date"), c("since", "Days since", "int")], rows);
    },
  },

  // Pharmacy & stores
  {
    id: "low_stock", title: "Low stock", category: "Pharmacy & stores", description: "Batches at or below their reorder level, lowest first.", param: "none",
    run: async (x) => table([c("name", "Item"), c("category", "Category"), c("stock", "In stock", "int"), c("min", "Reorder level", "int"), c("supplier", "Supplier")],
      (await x.data.pharmacy()).filter((i) => Number(i.stock) <= Number(i.min_stock)).sort((a, b) => Number(a.stock) - Number(b.stock)).map((i) => ({ name: i.name, category: i.category, stock: Number(i.stock), min: Number(i.min_stock), supplier: i.supplier } as Row))),
  },
  {
    id: "near_expiry", title: "Near expiry", category: "Pharmacy & stores", description: "Batches in stock that expire within 90 days, soonest first.", param: "none",
    run: async (x) => {
      const names = new Map((await x.data.pharmacy()).map((i) => [i.id, i.name] as const)); const limit = addDays(x.today, 90);
      return table([c("name", "Item"), c("batch", "Batch"), c("expiry", "Expires", "date"), c("days", "Days left", "int"), c("qty", "Quantity", "int")],
        (await x.data.batches()).filter((b) => Number(b.quantity) > 0 && b.expiry_date && b.expiry_date <= limit).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)).map((b) => ({ name: names.get(b.item_id) ?? `Item ${b.item_id}`, batch: b.batch_no, expiry: b.expiry_date, days: daysBetween(x.today, b.expiry_date), qty: Number(b.quantity) } as Row)));
    },
  },
];

function payoutReport(id: string, title: string, description: string, billType: "IPD" | "OPD" | null, roles: string[]): Def {
  return {
    id, title, category: "Accounts & statutory", description, param: "range",
    run: async (x) => {
      const bills = new Map((await x.data.bills()).map((b) => [b.id, b] as const));
      const rows = [...group((await x.data.payouts()).filter((p) => within(p.bill_date, x) && roles.includes(p.role) && (!billType || bills.get(p.bill_id)?.type === billType)), (p) => p.payee_name)]
        .map(([name, list]) => ({ name, bills: new Set(list.map((p) => p.bill_id)).size, gross: r2(list.reduce((n, p) => n + Number(p.amount), 0)), tds: 0, net: r2(list.reduce((n, p) => n + Number(p.amount), 0)) } as Row));
      return { ...table([c("name", "Payee"), c("bills", "Bills", "int"), c("gross", "Gross", "money"), c("tds", "TDS", "money"), c("net", "Net", "money")], rows, ["bills", "gross", "tds", "net"]), note: "TDS isn't deducted on payouts here, so net equals gross." };
    },
  };
}

function gstReport(id: string, title: string, description: string, type: "OPD" | "IPD"): Def {
  return {
    id, title, category: "Accounts & statutory", description, param: "range",
    run: async (x) => {
      const bills = (await x.data.bills()).filter((b) => within(b.bill_date, x) && b.type === type);
      const rows = bills.map((b) => ({ date: b.bill_date, bill: b.bill_number, patient: b.patient_name, taxable: r2(Number(b.amount) - Number(b.discount)), cgst: r2(Number(b.gst) / 2), sgst: r2(Number(b.gst) / 2), igst: 0, total: Number(b.total) } as Row));
      return { ...table([c("date", "Date", "date"), c("bill", "Bill no."), c("patient", "Patient"), c("taxable", "Taxable value", "money"), c("cgst", "CGST", "money"), c("sgst", "SGST", "money"), c("igst", "IGST", "money"), c("total", "Bill total", "money")], rows, ["taxable", "cgst", "sgst", "igst", "total"]), note: "Within-state supply assumed (CGST + SGST)." };
    },
  };
}

async function incomeGroup(x: Ctx, match: RegExp): Promise<ReportResult> {
  return table([c("code", "Code"), c("name", "Patient"), c("age", "Age", "int"), c("phone", "Phone"), c("group", "Income group")],
    (await x.data.patients()).filter((p) => p.income_group && match.test(p.income_group)).map((p) => ({ code: p.patient_code, name: p.name, age: p.age, phone: p.phone, group: p.income_group ?? "" } as Row)));
}

/** patient id → the days they came in (an OPD check-in, or an appointment that wasn't cancelled). */
async function patientVisitDays(x: Ctx): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const add = (id: number | null, day: string) => { if (id != null && day) (out.get(id) ?? out.set(id, []).get(id)!).push(day); };
  for (const v of await x.data.opd()) add(v.patient_id, dayOf(v.created_at));
  for (const a of await x.data.appts()) if (a.status !== "Cancelled") add(a.patient_id, a.appointment_date);
  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

const VISIT_COLS = [c("date", "Date", "date"), c("token", "Token"), c("patient", "Patient"), c("doctor", "Doctor"), c("reason", "Reason")];
const visitRow = (v: OpdVisitRow): Row => ({ date: dayOf(v.created_at), token: v.token_number, patient: v.patient_name, doctor: v.doctor, reason: v.reason });
/** The visits in the range that were (or weren't) the patient's first at this hospital. */
async function firstVisits(x: Ctx, first: boolean): Promise<OpdVisitRow[]> {
  const visits = [...(await x.data.opd())].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const seen = new Set<string>();
  const out: OpdVisitRow[] = [];
  for (const v of visits) {
    const key = v.patient_id != null ? `p${v.patient_id}` : `n${v.patient_name.toLowerCase()}`;
    const isFirst = !seen.has(key);
    seen.add(key);
    if (isFirst === first && within(dayOf(v.created_at), x)) out.push(v);
  }
  return out;
}

export const reportCatalog = (): ReportMeta[] => CATALOGUE.map((d) => ({ id: d.id, title: d.title, category: d.category, description: d.description, param: d.param, available: !!d.run }));

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface RunInput { id: string; from?: string; to?: string; q?: string }

export async function runReport(input: RunInput, actor: Session): Promise<ReportResult & { id: string; title: string; from: string; to: string; param: ReportParam }> {
  const def = CATALOGUE.find((d) => d.id === input.id);
  if (!def) throw new ValidationError([{ field: "id", message: "There's no such report" }]);
  const today = localDate();
  const bad = (v: string | undefined) => !!v && !ISO.test(v);
  if (bad(input.from) || bad(input.to)) throw new ValidationError([{ field: "from", message: "Dates must look like 2026-10-30" }]);
  // A day report is one date; "as on" runs up to a date; everything else is a range that defaults to this month.
  const to = input.to || today;
  const from = def.param === "day" ? input.from || input.to || today : input.from || `${to.slice(0, 8)}01`;
  const range = from <= to ? { from, to } : { from: to, to: from };
  if (!def.run) return { id: def.id, title: def.title, param: def.param, ...range, columns: [], rows: [], note: def.why ?? "This report isn't available yet." };
  const result = await def.run({ data: new Data(actor), ...range, q: input.q ?? "", today });
  return { id: def.id, title: def.title, param: def.param, ...range, ...result };
}
