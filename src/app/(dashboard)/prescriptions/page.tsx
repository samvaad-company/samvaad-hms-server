"use client";

import { tw } from "@/lib/design-system";
import { FileText, Plus, MoreVertical } from "lucide-react";
import { prescriptions } from "@/data/prescriptions";
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

function PrescriptionRow({ row }: { row: Prescription }) {
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
        <button className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors">
          <MoreVertical size={24} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export default function PrescriptionsPage() {
  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Create, manage, and dispense digital prescriptions for patients."
        stats={[{ icon: FileText, value: "10", label: "Total Prescriptions" }]}
        action={{ label: "New Prescription", icon: Plus }}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 655 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by Rx number, patient, or diagnosis..."
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {prescriptions.map((r) => (
              <PrescriptionRow key={r.id} row={r} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
