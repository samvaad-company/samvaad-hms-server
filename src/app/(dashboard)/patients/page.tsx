"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw, iconSize } from "@/lib/design-system";
import { User, Phone, Plus } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { PatientDTO } from "@/types/api";
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
  { label: "Patient Name", width: "minmax(150px,1.4fr)" },
  { label: "Age",          width: "64px" },
  { label: "Phone Number", width: "150px" },
  { label: "Gender",       width: "100px" },
  { label: "Reason",       width: "minmax(150px,1.6fr)" },
  { label: "Doctor",       width: "minmax(140px,1.3fr)" },
  { label: "Status",       width: "120px" },
  { label: "Date",         width: "110px" },
  { label: "Time",         width: "90px" },
  { label: "Action",       width: "52px", align: "right" as const },
];
const MIN_WIDTH = 1180;

const FILTERS = [
  { id: "All",       label: "All" },
  { id: "Today",     label: "Today (350)" },
  { id: "Completed", label: "Completed (670)" },
  { id: "Cancelled", label: "Cancelled (110)" },
];

// ─── Row Component ────────────────────────────────────────────────────────────

function PatientRow({ patient, actions }: { patient: Patient; actions: RowAction[] }) {
  return (
    <Link href={`/patients/${patient.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{patient.name}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{patient.age}</span>
      <div className="flex items-center gap-[5px] min-w-0">
        <Phone size={iconSize.sm} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
        <span className="text-[13px] font-normal text-[#11111c] truncate">{patient.phone}</span>
      </div>
      <div className="flex items-center gap-[6px] min-w-0">
        {patient.gender === "Male" ? <MaleIcon /> : <FemaleIcon />}
        <span className="text-[13px] font-normal text-[#11111c] truncate">{patient.gender}</span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{patient.reason}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{patient.doctor}</span>
      <div><StatusBadge status={patient.status} /></div>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{patient.date}</span>
      <span className="text-[12px] font-light text-[#57575f] whitespace-nowrap">{patient.time}</span>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const GENDER_OPTS = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];

export default function PatientsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { items: patients, loading, reload } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove } = useRowActions("patients", reload);

  const visible = patients.filter(p => {
    const matchF = filter === "All" || p.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.doctor.toLowerCase().includes(q) || p.reason.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
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
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by patient name, ID, or visit reason..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {loading && patients.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[#57575f]">Loading patients…</div>
            ) : visible.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[#57575f]">No patients found.</div>
            ) : (
              visible.map((p) => (
                <PatientRow
                  key={p.id}
                  patient={p}
                  actions={[
                    { label: "View details", onClick: () => router.push(`/patients/${p.id}`) },
                    { label: "Delete", danger: true, onClick: () => remove(p.id, p.name) },
                  ]}
                />
              ))
            )}
          </DataTable>
        </div>
      </div>
    </>
  );
}
