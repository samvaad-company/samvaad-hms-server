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
  { label: "Rx #",       left: 20  },
  { label: "Patient",    left: 150 },
  { label: "Doctor",     left: 370 },
  { label: "Diagnosis",  left: 580 },
  { label: "Medicines",  left: 840 },
  { label: "Date",       left: 980 },
  { label: "Status",     left: 1130 },
  { label: "Action",     left: 1340 },
];

const FILTERS = [
  { id: "All",       label: "All" },
  { id: "Dispensed", label: "Dispensed" },
  { id: "Pending",   label: "Pending" },
  { id: "Draft",     label: "Draft" },
];

const MIN_WIDTH = 1452;

function PrescriptionRow({ row, actions }: { row: Prescription; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ minWidth: MIN_WIDTH }}>
      <div className="absolute left-5">
        <span className="text-[14px] font-medium text-[#009598] leading-[19px]">
          {row.rxNumber}
        </span>
      </div>

      <div className="absolute flex flex-col justify-center" style={{ left: 150 }}>
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.patientName}
        </span>
        <span className="text-[12px] font-light text-[#57575f] leading-4">
          {row.patientAge} years old
        </span>
      </div>

      <div className="absolute" style={{ left: 370 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.doctor}
        </span>
      </div>

      <div className="absolute" style={{ left: 580 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.diagnosis}
        </span>
      </div>

      <div className="absolute" style={{ left: 840 }}>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#f6f6f6] text-[13px] font-medium text-[#11111c]">
          {row.medicineCount}
        </span>
      </div>

      <div className="absolute" style={{ left: 980 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.date}
        </span>
      </div>

      <div className="absolute" style={{ left: 1130 }}>
        <StatusBadge status={row.status} />
      </div>

      <div className="absolute" style={{ left: 1340 }}>
        <RowMenu actions={actions} />
      </div>
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
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 655 }}>
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
