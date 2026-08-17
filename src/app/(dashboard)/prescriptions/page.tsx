"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { FileText, Plus } from "lucide-react";
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

function PrescriptionRow({ row, actions }: { row: Prescription; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#009598] truncate">{row.rxNumber}</span>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.patientAge}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.doctor}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.diagnosis}</span>
      <div className="flex justify-center">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f6f6f6] text-[12px] font-medium text-[#11111c]">
          {row.medicineCount}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
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
          <div className="flex items-start justify-between gap-3 text-[13px] text-[#11111c] bg-[#e8f7f7] border border-[#b8e5e6] rounded-[10px] px-4 py-3">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-[#57575f] hover:text-[#11111c] shrink-0">✕</button>
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
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[#57575f]">No prescriptions found.</div>
            ) : visible.map((r) => (
              <PrescriptionRow key={r.id} row={r} actions={[
                { label: "View Rx", onClick: () => router.push(`/prescriptions/${r.id}`) },
                ...(canWrite ? [
                  { label: "Edit", onClick: () => openEdit(r) },
                  { label: "Dispense", disabled: r.status === "Dispensed", onClick: () => void dispense(r) },
                  { label: "Delete", danger: true, onClick: () => remove(r.id, r.rxNumber) },
                ] : []),
              ]} />
            ))}
          </DataTable>
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
              <button onClick={() => setEditing(null)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          }
        >
          <div className="mb-3 text-[12px] text-[#57575f]">
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
          <p className="mt-3 text-[11px] font-light text-[#57575f]">
            To change the medicine list, open the prescription and use the builder.
          </p>
        </Modal>
      )}
    </>
  );
}
