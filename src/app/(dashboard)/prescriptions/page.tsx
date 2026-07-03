"use client";

import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { FileText, Plus } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { PrescriptionDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
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
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.date}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

export default function PrescriptionsPage() {
  const router = useRouter();
  const { items: prescriptions, reload } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { dialog, remove, mutate } = useRowActions("prescriptions", reload);
  return (
    <>
      {dialog}
      <PageHeader
        title="Prescriptions"
        subtitle="Create, manage, and dispense digital prescriptions for patients."
        stats={[{ icon: FileText, value: `${prescriptions.length}`, label: "Total Prescriptions" }]}
        action={{ label: "New Prescription", icon: Plus, onClick: () => router.push("/prescriptions/new") }}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by Rx number, patient, or diagnosis..."
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {prescriptions.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[#57575f]">No prescriptions found.</div>
            ) : prescriptions.map((r) => (
              <PrescriptionRow key={r.id} row={r} actions={[
                { label: "View Rx", onClick: () => router.push(`/prescriptions/${r.id}`) },
                { label: "Dispense", disabled: r.status === "Dispensed", onClick: () => mutate(() => api.post(`/prescriptions/${r.id}/dispense`)) },
                { label: "Delete", danger: true, onClick: () => remove(r.id, r.rxNumber) },
              ]} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
