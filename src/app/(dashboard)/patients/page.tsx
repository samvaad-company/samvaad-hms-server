"use client";

import { useState } from "react";
import { tw, iconSize } from "@/lib/design-system";
import { User, Phone, MoreVertical, Plus } from "lucide-react";
import { patients } from "@/data/patients";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { Patient } from "@/types";
import Link from "next/link";

// ─── Gender Icons ─────────────────────────────────────────────────────────────

function MaleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="9.5" r="3.5" stroke="#11111C" strokeWidth="1.2" />
      <path d="M9.5 6.5L13 3" stroke="#11111C" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 3H13V5.5" stroke="#11111C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FemaleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="5.5" r="3.5" stroke="#11111C" strokeWidth="1.2" />
      <path d="M8 9V14" stroke="#11111C" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.5 11.5H10.5" stroke="#11111C" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Column Definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient Name",              left: tw.columns.patientName },
  { label: "Phone Number",              left: tw.columns.phoneNumber },
  { label: "Gender",                    left: tw.columns.gender },
  { label: "Reason",                    left: tw.columns.reason },
  { label: "Doctor Assigned",           left: tw.columns.doctorAssigned },
  { label: "Status",                    left: tw.columns.status },
  { label: "Appointment Date and Time", left: tw.columns.appointmentDate },
  { label: "Action",                    left: tw.columns.action },
];

const FILTERS = [
  { id: "All",       label: "All" },
  { id: "Today",     label: "Today (350)" },
  { id: "Completed", label: "Completed (670)" },
  { id: "Cancelled", label: "Cancelled (110)" },
];

// ─── Row Component ────────────────────────────────────────────────────────────

function PatientRow({ patient }: { patient: Patient }) {
  return (
    <Link href={`/patients/${patient.id}`} className={`${tw.table.dataRow} block`} style={{ minWidth: tw.table.minWidth }}>
      <div className="absolute left-5 flex flex-col justify-center">
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">
          {patient.name}
        </span>
        <span className="text-[12px] font-light text-[#57575f] leading-4 whitespace-nowrap">
          {patient.age} years old
        </span>
      </div>

      <div className="absolute flex items-center gap-[5px]" style={{ left: tw.columns.phoneNumber }}>
        <Phone size={iconSize.md} strokeWidth={1.5} className="text-[#11111c] shrink-0" />
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {patient.phone}
        </span>
      </div>

      <div className="absolute flex items-center gap-[10px]" style={{ left: tw.columns.gender }}>
        {patient.gender === "Male" ? <MaleIcon /> : <FemaleIcon />}
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {patient.gender}
        </span>
      </div>

      <div className="absolute" style={{ left: tw.columns.reason }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {patient.reason}
        </span>
      </div>

      <div className="absolute" style={{ left: tw.columns.doctorAssigned }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {patient.doctor}
        </span>
      </div>

      <div className="absolute" style={{ left: tw.columns.status }}>
        <StatusBadge status={patient.status} />
      </div>

      <div className="absolute flex flex-col gap-[3px]" style={{ left: tw.columns.appointmentDate }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
          {patient.date}
        </span>
        <span className="text-[12px] font-light text-[#57575f] leading-4">
          {patient.time}
        </span>
      </div>

      <div className="absolute" style={{ left: tw.columns.action }}>
        <button className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors">
          <MoreVertical size={24} strokeWidth={1.5} />
        </button>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const GENDER_OPTS = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];

export default function PatientsPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const visible = patients.filter(p => {
    const matchF = filter === "All" || p.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.doctor.toLowerCase().includes(q) || p.reason.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Quick Register Patient"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <Link href="/patients/new" onClick={() => setShowModal(false)} className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">Full Registration Form →</Link>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Full Name *"><FormInput placeholder="Patient's full name" /></FormRow>
          <FormRow label="Mobile *"><FormInput placeholder="+91 XXXXX XXXXX" type="tel" /></FormRow>
          <FormRow label="Date of Birth *"><FormInput type="date" /></FormRow>
          <FormRow label="Gender *"><FormSelect placeholder="Select gender" options={GENDER_OPTS} /></FormRow>
          <div className="col-span-2"><FormRow label="Reason for Visit"><FormInput placeholder="Brief reason" /></FormRow></div>
          <div className="col-span-2 border-t border-[#f0f0f0] pt-3">
            <p className="text-[12px] font-light text-[#57575f]">For medical history, address & insurance — use the full registration form.</p>
          </div>
        </div>
      </Modal>

      <PageHeader
        title="Patients"
        subtitle="Manage your patient records, review visit history, and track ongoing treatments — all in one place."
        stats={[{ icon: User, value: `${visible.length}`, label: "Matching Patients" }]}
        action={{ label: "Add Patient", icon: Plus, onClick: () => setShowModal(true) }}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 655 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by patient name, ID, or visit reason..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS}>
            {visible.map((p) => (
              <PatientRow key={p.id} patient={p} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
