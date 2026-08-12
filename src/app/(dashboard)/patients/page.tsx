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
import { inDateRange, type DateRangeId } from "@/lib/dates";
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
const MIN_WIDTH = 1320;

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

export default function PatientsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRangeId>("all");
  const { items: patients, loading, reload } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove } = useRowActions("patients", reload);

  const visible = patients.filter(p => {
    const matchF = filter === "All" || p.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.doctor.toLowerCase().includes(q) || p.reason.toLowerCase().includes(q);
    return matchF && matchS && inDateRange(p.date, range);
  });

  return (
    <>
      {dialog}
      <PageHeader
        title="Patients"
        subtitle="Manage your patient records, review visit history, and track ongoing treatments — all in one place."
        stats={[{ icon: User, value: `${visible.length}`, label: "Matching Patients" }]}
        action={{ label: "Add Patient", icon: Plus, onClick: () => router.push("/patients/new") }}
        range={range}
        onRangeChange={setRange}
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
