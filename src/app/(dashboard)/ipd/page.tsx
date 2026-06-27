"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { BedDouble, Plus, MoreVertical } from "lucide-react";
import { ipdRecords } from "@/data/ipd";
import { patients } from "@/data/patients";
import { doctors } from "@/data/doctors";
import { beds } from "@/data/beds";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormSelect, FormInput, FormTextarea } from "@/components/shared/FormRow";
import Link from "next/link";
import type { IpdRecord } from "@/types";

const COLUMNS = [
  { label: "Patient",          left: 20  },
  { label: "Patient ID",       left: 230 },
  { label: "Admission Date",   left: 390 },
  { label: "Ward / Bed",       left: 600 },
  { label: "Doctor",           left: 760 },
  { label: "Diagnosis",        left: 990 },
  { label: "Status",           left: 1210 },
  { label: "Action",           left: 1380 },
];

const FILTERS = [
  { id: "All",        label: "All" },
  { id: "Admitted",   label: "Admitted" },
  { id: "ICU",        label: "ICU" },
  { id: "Discharged", label: "Discharged" },
];

const MIN_WIDTH = 1452;

function IpdRow({ row }: { row: IpdRecord }) {
  return (
    <Link href={`/ipd/${row.id}`} className={`${tw.table.dataRow} block`} style={{ minWidth: MIN_WIDTH }}>
      <div className="absolute left-5 flex flex-col justify-center">
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.patientName}
        </span>
        <span className="text-[12px] font-light text-[#57575f] leading-4">
          {row.patientAge} years old
        </span>
      </div>

      <div className="absolute" style={{ left: 230 }}>
        <span className="text-[12px] font-medium text-[#009598] leading-4">
          {row.patientId}
        </span>
      </div>

      <div className="absolute" style={{ left: 390 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.admissionDate}
        </span>
      </div>

      <div className="absolute flex flex-col gap-[2px]" style={{ left: 600 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.ward}
        </span>
        <span className="text-[12px] font-light text-[#57575f] leading-4">
          Bed {row.bed}
        </span>
      </div>

      <div className="absolute" style={{ left: 760 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.doctor}
        </span>
      </div>

      <div className="absolute" style={{ left: 990 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.diagnosis}
        </span>
      </div>

      <div className="absolute" style={{ left: 1210 }}>
        <StatusBadge status={row.status} />
      </div>

      <div className="absolute" style={{ left: 1380 }}>
        <button className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors" onClick={e => e.preventDefault()}>
          <MoreVertical size={24} strokeWidth={1.5} />
        </button>
      </div>
    </Link>
  );
}

const WARD_OPTS = [...new Set(beds.map(b => b.ward))].map(w => ({ value: w, label: w }));

export default function IpdPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [ward, setWard] = useState("");

  const visible = ipdRecords.filter(r => {
    const matchF = filter === "All" || r.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || r.patientName.toLowerCase().includes(q) || r.patientId.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q) || r.diagnosis.toLowerCase().includes(q);
    return matchF && matchS;
  });

  const availableBeds = beds.filter(b => b.ward === ward && b.status === "Available");

  return (
    <>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Quick Admission" width={640}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <Link href="/ipd/new" onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Full Form →</Link>
            <button className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">Admit Patient</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient *"><FormSelect placeholder="Search patient" options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} /></FormRow>
          <FormRow label="Admission Date *"><FormInput type="date" /></FormRow>
          <FormRow label="Doctor *"><FormSelect placeholder="Select doctor" options={doctors.map(d => ({ value: String(d.id), label: d.name }))} /></FormRow>
          <FormRow label="Ward *"><FormSelect placeholder="Select ward" options={WARD_OPTS} value={ward} onChange={setWard} /></FormRow>
          <FormRow label="Bed *"><FormSelect placeholder={ward ? `${availableBeds.length} available` : "Select ward first"} options={availableBeds.map(b => ({ value: String(b.id), label: b.bedNumber }))} /></FormRow>
          <FormRow label="Status"><FormSelect placeholder="Status" options={["Admitted","ICU"].map(s => ({ value: s, label: s }))} /></FormRow>
          <div className="col-span-2"><FormRow label="Diagnosis / Reason"><FormInput placeholder="Provisional diagnosis or reason for admission" /></FormRow></div>
        </div>
      </Modal>

      <PageHeader
        title="IPD"
        subtitle="Manage inpatient admissions, ward assignments, and discharge records."
        stats={[{ icon: BedDouble, value: `${visible.filter(r => r.status !== "Discharged").length}`, label: "Active Admissions" }]}
        action={{ label: "New Admission", icon: Plus, onClick: () => setShowModal(true) }}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 655 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by patient name, ID, or ward..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.map((r) => (
              <IpdRow key={r.id} row={r} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
