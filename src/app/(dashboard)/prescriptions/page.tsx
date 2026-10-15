"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { FileText, LayoutList, Plus, Table2 } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { inDateRange, type DateRangeId, formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { PrescriptionDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { Prescription } from "@/types";

const COLUMNS = [
  { label: "Rx #",      width: "130px" },
  { label: "Patient",   width: "minmax(140px,1.4fr)" },
  { label: "Age",       width: "60px" },
  { label: "Doctor",    width: "minmax(140px,1.3fr)" },
  { label: "Diagnosis", width: "minmax(160px,1.6fr)" },
  { label: "Meds",      width: "70px", align: "center" as const },
  { label: "Date",      width: "110px" },
  { label: "Status",    width: "120px" },
  { label: "Action",    width: "52px", align: "right" as const },
];

const FILTERS = [
  { id: "All",       label: "All" },
  { id: "Dispensed", label: "Dispensed" },
  { id: "Pending",   label: "Pending" },
  { id: "Draft",     label: "Draft" },
];

const MIN_WIDTH = 1180;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const VIEW_STORAGE_KEY = "samvaad.prescriptions.view";
type ListView = "table" | "compact";
const viewListeners = new Set<() => void>();

/**
 * The list view (Table / Compact) the user picked last, kept in localStorage.
 * Server render and hydration use "table"; the saved choice is applied right after.
 */
function useSavedView(): [ListView, (next: ListView) => void] {
  const view = useSyncExternalStore<ListView>(
    (notify) => {
      viewListeners.add(notify);
      window.addEventListener("storage", notify);
      return () => { viewListeners.delete(notify); window.removeEventListener("storage", notify); };
    },
    () => {
      try { return window.localStorage.getItem(VIEW_STORAGE_KEY) === "compact" ? "compact" : "table"; } catch { return "table"; }
    },
    () => "table",
  );
  const choose = (next: ListView) => {
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* storage blocked — the choice just won't persist */ }
    viewListeners.forEach((l) => l());
  };
  return [view, choose];
}

/** "2026-09-26" → "Sat, 26 Sept" (the compact list's date). Anything else is shown as it is. */
function shortDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return formatDate(value);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** One line per prescription: patient, then "Rx number · day", with the status at the right. */
function CompactRow({ row, actions, onOpen }: { row: Prescription; actions: RowAction[]; onOpen: () => void }) {
  return (
    <div
      role="link" tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className="group flex items-center gap-3 px-5 py-[9px] border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--subtle)] focus:outline-none focus-visible:bg-[color:var(--subtle)] cursor-pointer transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[color:var(--ink)] truncate leading-[17px]">{row.patientName}</p>
        <p className="text-[11.5px] text-[color:var(--ink-soft)] truncate leading-[16px]">
          {row.status === "Draft" ? "Draft" : row.rxNumber} · {shortDay(row.date)}
        </p>
      </div>
      <div className="w-[28px] flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <RowMenu actions={actions} compact />
      </div>
      <StatusBadge status={row.status} />
    </div>
  );
}

function PrescriptionRow({ row, actions, onOpen }: { row: Prescription; actions: RowAction[]; onOpen: () => void }) {
  return (
    <div
      role="link" tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className={`${tw.table.dataRow} cursor-pointer focus:outline-none focus-visible:bg-[color:var(--faint)]`}
      style={{ gridTemplateColumns: "var(--cols)" }}
    >
      <span className="text-[13px] font-medium text-[color:var(--brand)] truncate">{row.rxNumber}</span>
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">{row.patientAge}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.doctor}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.diagnosis}</span>
      <div className="flex justify-center">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--subtle)] text-[12px] font-medium text-[color:var(--ink)]">
          {row.medicineCount}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[color:var(--ink)] whitespace-nowrap">{formatDate(row.date)}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><RowMenu actions={actions} /></div>
    </div>
  );
}

export default function PrescriptionsPage() {
  const { can } = useAuth();
  const canWrite = can("prescriptions", "write");
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRangeId>("all");
  const [view, chooseView] = useSavedView();
  const { items: prescriptions, reload } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { dialog, remove, mutate } = useRowActions("prescriptions", reload);
  const { run: runEdit, loading: saving } = useMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<PrescriptionDTO | null>(null);
  const [editForm, setEditForm] = useState({ diagnosis: "", status: "Pending" });

  /** Dispense and report anything the pharmacy could not fulfil. */
  async function dispense(rx: PrescriptionDTO) {
    setNotice(null);
    const res = await api.post<PrescriptionDTO & {
      dispense?: {
        adjustments: { name: string; units: number }[];
        unmatched: string[];
        shortStocked: { name: string; needed: number; available: number }[];
      };
    }>(`/prescriptions/${rx.id}/dispense`);
    const d = res?.dispense;
    const parts: string[] = [];
    if (d?.adjustments?.length) {
      parts.push(`Stock updated: ${d.adjustments.map(a => `${a.name} (−${a.units})`).join(", ")}.`);
    }
    if (d?.shortStocked?.length) {
      parts.push(`Short stock: ${d.shortStocked.map(s => `${s.name} needed ${s.needed}, had ${s.available}`).join("; ")}.`);
    }
    if (d?.unmatched?.length) {
      parts.push(`Not found in pharmacy inventory: ${d.unmatched.join(", ")}.`);
    }
    setNotice(parts.join(" ") || "Prescription dispensed.");
    reload();
  }

  function openEdit(rx: PrescriptionDTO) {
    setEditForm({ diagnosis: rx.diagnosis, status: rx.status });
    setEditing(rx);
  }
  async function saveEdit() {
    if (!editing) return;
    await runEdit(() => api.patch(`/prescriptions/${editing.id}`, editForm));
    setEditing(null);
    reload();
  }

  const visible = prescriptions.filter(r => {
    const matchF = filter === "All" || r.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || r.rxNumber.toLowerCase().includes(q) || r.patientName.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q) || r.diagnosis.toLowerCase().includes(q);
    return matchF && matchS && inDateRange(r.date, range);
  });

  const { rows: pagedVisible, bar: barVisible } = usePagination(visible, "prescriptions");

  const actionsFor = (r: PrescriptionDTO): RowAction[] => [
    { label: "View Rx", onClick: () => router.push(`/prescriptions/${r.id}`) },
    ...(canWrite ? [
      { label: "Edit", onClick: () => openEdit(r) },
      { label: "Dispense", disabled: r.status === "Dispensed", onClick: () => void dispense(r) },
      { label: "Delete", danger: true, onClick: () => remove(r.id, r.rxNumber) },
    ] : []),
  ];

  const viewSwitch = (
    <div role="group" aria-label="Prescription view" className="inline-flex items-center p-[2px] rounded-full bg-[color:var(--subtle)] shrink-0">
      {([["table", "Table", Table2], ["compact", "Compact", LayoutList]] as const).map(([id, label, Icon]) => (
        <button key={id} type="button" onClick={() => chooseView(id)} aria-pressed={view === id} title={`${label} view`}
          className={`inline-flex items-center gap-[5px] h-[28px] px-3 rounded-full text-[12px] transition-colors cursor-pointer ${
            view === id ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          }`}>
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {dialog}
      <PageHeader
        title="Prescriptions"
        subtitle="Create, manage, and dispense digital prescriptions for patients."
        stats={[{ icon: FileText, value: `${visible.length}`, label: "Prescriptions" }]}
        action={canWrite ? { label: "New Prescription", icon: Plus, onClick: () => router.push("/prescriptions/new") } : undefined}
        range={range}
        onRangeChange={setRange}
      />

      {notice && (
        <div className={`${tw.gutterX} mb-3`}>
          <div className="flex items-start justify-between gap-3 text-[13px] text-[color:var(--ink)] bg-[color:var(--brand-soft)] border border-[#b8e5e6] rounded-[10px] px-4 py-3">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] shrink-0">✕</button>
          </div>
        </div>
      )}

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by Rx number, patient, or diagnosis..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
            trailing={viewSwitch}
          />
          {view === "compact" ? (
            <div className="border-t border-[color:var(--line)]">
              {visible.length === 0 ? (
                <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No prescriptions found.</div>
              ) : pagedVisible.map(r => (
                <CompactRow key={r.id} row={r} actions={actionsFor(r)} onOpen={() => router.push(`/prescriptions/${r.id}`)} />
              ))}
            </div>
          ) : (
            <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
              {visible.length === 0 ? (
                <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No prescriptions found.</div>
              ) : pagedVisible.map((r) => (
                <PrescriptionRow key={r.id} row={r} actions={actionsFor(r)} onOpen={() => router.push(`/prescriptions/${r.id}`)} />
              ))}
            </DataTable>
          )}
          {barVisible}
        </div>
      </div>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={`Edit ${editing.rxNumber}`}
          width={520}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          }
        >
          <div className="mb-3 text-[12px] text-[color:var(--ink-soft)]">
            {editing.patientName} · {editing.doctor} · {editing.medicineCount} medicines
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormRow label="Diagnosis">
                <FormInput value={editForm.diagnosis} onChange={v => setEditForm(f => ({ ...f, diagnosis: v }))} />
              </FormRow>
            </div>
            <FormRow label="Status">
              <FormSelect value={editForm.status} onChange={v => setEditForm(f => ({ ...f, status: v }))}
                options={["Draft", "Pending", "Dispensed"].map(s => ({ value: s, label: s }))} />
            </FormRow>
          </div>
          <p className="mt-3 text-[11px] font-light text-[color:var(--ink-soft)]">
            To change the medicine list, open the prescription and use the builder.
          </p>
        </Modal>
      )}
    </>
  );
}
