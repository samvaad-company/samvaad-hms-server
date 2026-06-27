"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { Activity, Plus, MoreVertical, CheckCircle, XCircle } from "lucide-react";
import { opdRecords } from "@/data/opd";
import { patients } from "@/data/patients";
import { doctors } from "@/data/doctors";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { OpdRecord } from "@/types";

const COLUMNS = [
  { label: "Token #",         left: 20  },
  { label: "Patient",         left: 110 },
  { label: "Doctor",          left: 330 },
  { label: "Vitals Recorded", left: 560 },
  { label: "Wait Time",       left: 760 },
  { label: "Check-in",        left: 930 },
  { label: "Status",          left: 1100 },
  { label: "Action",          left: 1340 },
];

const FILTERS = [
  { id: "All",             label: "All" },
  { id: "Waiting",         label: "Waiting" },
  { id: "InConsultation",  label: "In Consultation" },
  { id: "Completed",       label: "Completed" },
];

const MIN_WIDTH = 1452;

function OpdRow({ row }: { row: OpdRecord }) {
  return (
    <div className={tw.table.dataRow} style={{ minWidth: MIN_WIDTH }}>
      <div className="absolute left-5">
        <span className="text-[14px] font-medium text-[#009598] leading-[19px]">
          {row.tokenNumber}
        </span>
      </div>

      <div className="absolute flex flex-col justify-center" style={{ left: 110 }}>
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.patientName}
        </span>
        <span className="text-[12px] font-light text-[#57575f] leading-4">
          {row.patientAge} years old
        </span>
      </div>

      <div className="absolute" style={{ left: 330 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {row.doctor}
        </span>
      </div>

      <div className="absolute flex items-center gap-[6px]" style={{ left: 560 }}>
        {row.vitalsRecorded ? (
          <CheckCircle size={16} className="text-[#00955c]" />
        ) : (
          <XCircle size={16} className="text-[#ff0004]" />
        )}
        <span className={`text-[14px] font-normal leading-[19px] ${row.vitalsRecorded ? "text-[#00955c]" : "text-[#ff0004]"}`}>
          {row.vitalsRecorded ? "Recorded" : "Pending"}
        </span>
      </div>

      <div className="absolute" style={{ left: 760 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">
          {row.waitTime}
        </span>
      </div>

      <div className="absolute" style={{ left: 930 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">
          {row.checkInTime}
        </span>
      </div>

      <div className="absolute" style={{ left: 1100 }}>
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

const STATUS_MAP: Record<string, string> = { "InConsultation": "In Consultation" };
const NEXT_TOKEN = `T-${String(opdRecords.length + 1).padStart(3, "0")}`;

export default function OpdPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const visible = opdRecords.filter(r => {
    const matchF = filter === "All" || r.status === (STATUS_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || r.patientName.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q) || r.tokenNumber.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New OPD Check-in"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">Issue Token</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex items-center gap-3 p-3 bg-[#e8f7f7] rounded-[10px]">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-[#009598] uppercase tracking-wider">Next Token</span>
              <span className="text-[24px] font-medium text-[#009598]">{NEXT_TOKEN}</span>
            </div>
          </div>
          <FormRow label="Patient *">
            <FormSelect placeholder="Search patient" options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} />
          </FormRow>
          <FormRow label="Doctor *">
            <FormSelect placeholder="Select doctor" options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
          </FormRow>
          <div className="col-span-2"><FormRow label="Chief Complaint"><FormInput placeholder="Brief reason for visit" /></FormRow></div>
          <FormRow label="Vitals Recorded">
            <FormSelect placeholder="Status" options={[{ value: "yes", label: "Yes — Recorded" }, { value: "no", label: "No — Pending" }]} />
          </FormRow>
          <FormRow label="Priority">
            <FormSelect placeholder="Normal" options={[{ value: "normal", label: "Normal" }, { value: "urgent", label: "Urgent" }, { value: "emergency", label: "Emergency" }]} />
          </FormRow>
        </div>
      </Modal>

      <PageHeader
        title="OPD Queue"
        subtitle="Manage today's outpatient queue — track tokens, vitals, and consultation status in real time."
        stats={[{ icon: Activity, value: `${visible.length}`, label: "Active Tokens" }]}
        action={{ label: "New Check-in", icon: Plus, onClick: () => setShowModal(true) }}
        dateRange={false}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 655 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by token, patient name, or doctor..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.map((r) => (
              <OpdRow key={r.id} row={r} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
