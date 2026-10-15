"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { Wallet, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { FinanceEntryDTO } from "@/types/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";

const INCOME_CATEGORIES = [
  "Canteen Rent", "Parking Fees", "Health Campaign", "Equipment Rental",
  "Training & Workshops", "Donation", "Miscellaneous",
];
const EXPENSE_CATEGORIES = [
  "Electricity Bill", "Water Bill", "Generator Fuel", "Equipment Maintenance",
  "Housekeeping", "Security Services", "Stationery", "Waste Disposal",
  "Miscellaneous",
];

const COLUMNS = [
  { label: "Category",    width: "minmax(160px,1.2fr)" },
  { label: "Description", width: "minmax(220px,2fr)" },
  { label: "Invoice #",   width: "120px" },
  { label: "Date",        width: "110px" },
  { label: "Amount",      width: "130px", align: "right" as const },
  { label: "Action",      width: "52px", align: "right" as const },
];

function EntryRow({ row, amountClass, actions }: { row: FinanceEntryDTO; amountClass: string; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{row.category}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.description}</span>
      <span className="text-[13px] font-normal text-[color:var(--brand)] whitespace-nowrap">{row.invoiceNumber || "—"}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className={`text-[13px] font-medium text-right ${amountClass}`}>₹{row.amount.toLocaleString("en-IN")}</span>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

export default function FinancePage() {
  const { can } = useAuth();
  const canWrite = can("finance", "write");
  const [tab, setTab] = useState("income");
  const [incomeFilter, setIncomeFilter] = useState("All");
  const [incomeSearch, setIncomeSearch] = useState("");
  const [expenseFilter, setExpenseFilter] = useState("All");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [modal, setModal] = useState<"" | "income" | "expense">("");

  const { items: incomes, reload: reloadIncomes } = useList<FinanceEntryDTO>("/finance/income", { all: true });
  const { items: expenses, reload: reloadExpenses } = useList<FinanceEntryDTO>("/finance/expense", { all: true });
  const incomeActions = useRowActions("finance/income", reloadIncomes);
  const expenseActions = useRowActions("finance/expense", reloadExpenses);
  const { run, loading, error, reset } = useMutation();

  const [form, setForm] = useState({ category: "", description: "", invoiceNumber: "", amount: "" });
  const closeModal = () => { setModal(""); reset(); };

  async function submitEntry() {
    const path = modal === "income" ? "/finance/income" : "/finance/expense";
    await run(() => api.post(path, {
      category: form.category,
      description: form.description,
      invoiceNumber: form.invoiceNumber,
      amount: Number(form.amount),
    }));
    setForm({ category: "", description: "", invoiceNumber: "", amount: "" });
    const isIncome = modal === "income";
    closeModal();
    if (isIncome) reloadIncomes(); else reloadExpenses();
  }

  const totalIncome = incomes.reduce((s, e) => s + e.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpense;

  const TABS = [
    { id: "income",   label: "Income",   count: incomes.length },
    { id: "expenses", label: "Expenses", count: expenses.length },
  ];

  const categoryFilters = (categories: string[]) =>
    [{ id: "All", label: "All" }, ...categories.map(c => ({ id: c, label: c }))];

  const visibleIncomes = incomes.filter(e => {
    const matchF = incomeFilter === "All" || e.category === incomeFilter;
    const q = incomeSearch.toLowerCase();
    return matchF && (!q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.invoiceNumber.toLowerCase().includes(q));
  });

  const { rows: pagedVisibleIncomes, bar: barVisibleIncomes } = usePagination(visibleIncomes, "records");
  const visibleExpenses = expenses.filter(e => {
    const matchF = expenseFilter === "All" || e.category === expenseFilter;
    const q = expenseSearch.toLowerCase();
    return matchF && (!q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.invoiceNumber.toLowerCase().includes(q));
  });
  const { rows: pagedVisibleExpenses, bar: barVisibleExpenses } = usePagination(visibleExpenses, "records");

  const isIncomeModal = modal === "income";

  return (
    <>
      {incomeActions.dialog}
      {expenseActions.dialog}

      <Modal open={modal !== ""} onClose={closeModal} title={isIncomeModal ? "Add Income" : "Add Expense"}
        footer={
          <>
            <button onClick={closeModal} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
            <button onClick={submitEntry} disabled={loading || !form.category || !form.description || !form.amount}
              className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {loading ? "Saving…" : isIncomeModal ? "Add Income" : "Add Expense"}
            </button>
          </>
        }>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Category *">
            <FormSelect placeholder="Select category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}
              options={(isIncomeModal ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => ({ value: c, label: c }))} />
          </FormRow>
          <FormRow label="Amount (₹) *"><FormInput type="number" placeholder="0" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} /></FormRow>
          <FormRow label="Description *"><FormInput placeholder="What is this entry for?" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} /></FormRow>
          <FormRow label="Invoice / Ref #"><FormInput placeholder="Optional reference" value={form.invoiceNumber} onChange={v => setForm(f => ({ ...f, invoiceNumber: v }))} /></FormRow>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      <PageHeader
        title="Income & Expense"
        subtitle="Track non-clinical hospital income and operating expenses by category."
        stats={[{ icon: Wallet, value: `₹${net.toLocaleString("en-IN")}`, label: "Net Position" }]}
        action={canWrite ? { label: tab === "expenses" ? "Add Expense" : "Add Income", icon: Plus, onClick: () => setModal(tab === "expenses" ? "expense" : "income") } : undefined}
      />

      <div className={`${tw.gutterX} mb-5 grid grid-cols-2 gap-4`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex items-center justify-between`}>
          <div>
            <p className="text-[12px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Total Income</p>
            <p className="text-[24px] font-medium text-[#00955c] mt-1">₹{totalIncome.toLocaleString("en-IN")}</p>
          </div>
          <TrendingUp size={28} className="text-[#00955c]" />
        </div>
        <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex items-center justify-between`}>
          <div>
            <p className="text-[12px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Total Expenses</p>
            <p className="text-[24px] font-medium text-[#ff0004] mt-1">₹{totalExpense.toLocaleString("en-IN")}</p>
          </div>
          <TrendingDown size={28} className="text-[#ff0004]" />
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 570 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "income" && (
            <>
              <FilterBar filters={categoryFilters(INCOME_CATEGORIES.slice(0, 3))} statusLabel="Category"
                searchPlaceholder="Search income entries..."
                activeFilter={incomeFilter} onFilterChange={setIncomeFilter}
                searchQuery={incomeSearch} onSearchChange={setIncomeSearch}
                action={canWrite ? { label: "Add Income", icon: Plus, onClick: () => setModal("income") } : undefined} />
              <DataTable columns={COLUMNS} minWidth={1050}>
                {visibleIncomes.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No income entries.</div>
                ) : pagedVisibleIncomes.map(e => (
                  <EntryRow key={e.id} row={e} amountClass="text-[#00955c]" actions={canWrite ? [
                    { label: "Delete", danger: true, onClick: () => incomeActions.remove(e.id, e.description) },
                  ] : []} />
                ))}
              </DataTable>
{barVisibleIncomes}
            </>
          )}

          {tab === "expenses" && (
            <>
              <FilterBar filters={categoryFilters(EXPENSE_CATEGORIES.slice(0, 3))} statusLabel="Category"
                searchPlaceholder="Search expense entries..."
                activeFilter={expenseFilter} onFilterChange={setExpenseFilter}
                searchQuery={expenseSearch} onSearchChange={setExpenseSearch}
                action={canWrite ? { label: "Add Expense", icon: Plus, onClick: () => setModal("expense") } : undefined} />
              <DataTable columns={COLUMNS} minWidth={1050}>
                {visibleExpenses.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No expense entries.</div>
                ) : pagedVisibleExpenses.map(e => (
                  <EntryRow key={e.id} row={e} amountClass="text-[#ff0004]" actions={canWrite ? [
                    { label: "Delete", danger: true, onClick: () => expenseActions.remove(e.id, e.description) },
                  ] : []} />
                ))}
              </DataTable>
{barVisibleExpenses}
            </>
          )}
        </div>
      </div>
    </>
  );
}
