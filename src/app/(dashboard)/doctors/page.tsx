"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { Stethoscope, Plus, MoreVertical, Phone } from "lucide-react";
import { doctors } from "@/data/doctors";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import Link from "next/link";
import type { Doctor } from "@/types";

const COLUMNS = [
  { label: "Doctor",         left: 20   },
  { label: "Contact",        left: 280  },
  { label: "Department",     left: 490  },
  { label: "Experience",     left: 680  },
  { label: "Patients Today", left: 850  },
  { label: "Status",         left: 1060 },
  { label: "Action",         left: 1280 },
];

const FILTERS = [
  { id: "All",      label: "All" },
  { id: "Active",   label: "Active" },
  { id: "InOPD",    label: "In OPD" },
  { id: "OnLeave",  label: "On Leave" },
];

const FILTER_MAP: Record<string, string> = { "InOPD": "In OPD", "OnLeave": "On Leave" };
const MIN_WIDTH = 1400;

function DoctorRow({ row }: { row: Doctor }) {
  return (
    <Link href={`/doctors/${row.id}`} className={`${tw.table.dataRow} block`} style={{ minWidth: MIN_WIDTH }}>
      <div className="absolute left-5 flex flex-col justify-center">
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">{row.name}</span>
        <span className="text-[12px] font-light text-[#57575f] leading-4 whitespace-nowrap">{row.specialty}</span>
      </div>
      <div className="absolute flex items-center gap-[5px]" style={{ left: 280 }}>
        <Phone size={14} strokeWidth={1.5} className="text-[#11111c] shrink-0" />
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">{row.phone}</span>
      </div>
      <div className="absolute" style={{ left: 490 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">{row.department}</span>
      </div>
      <div className="absolute" style={{ left: 680 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">{row.experience}</span>
      </div>
      <div className="absolute" style={{ left: 850 }}>
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px]">{row.patientsToday}</span>
      </div>
      <div className="absolute" style={{ left: 1060 }}><StatusBadge status={row.status} /></div>
      <div className="absolute" style={{ left: 1280 }}>
        <button className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors" onClick={e => e.preventDefault()}>
          <MoreVertical size={24} strokeWidth={1.5} />
        </button>
      </div>
    </Link>
  );
}

const SPECIALTY_OPTS = ["General Physician","Paediatrician","Cardiologist","Neurologist","Orthopaedic Surgeon","Dermatologist","Gastroenterologist","Endocrinologist","Pulmonologist","Physiotherapist"].map(s => ({ value: s.toLowerCase(), label: s }));
const DEPT_OPTS = ["OPD","Paediatrics","Cardiology","Neurology","Ortho","Skin","Surgery","Internal Med","Respiratory","Rehab"].map(d => ({ value: d.toLowerCase(), label: d }));
const STATUS_OPTS = [{ value: "Active", label: "Active" }, { value: "In OPD", label: "In OPD" }, { value: "On Leave", label: "On Leave" }];

export default function DoctorsPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const visible = doctors.filter(d => {
    const matchF = filter === "All" || d.status === (FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.department.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Doctor"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">Add Doctor</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormRow label="Full Name *"><FormInput placeholder="Dr. First Last" /></FormRow></div>
          <FormRow label="Specialty *"><FormSelect placeholder="Select specialty" options={SPECIALTY_OPTS} /></FormRow>
          <FormRow label="Department *"><FormSelect placeholder="Select dept" options={DEPT_OPTS} /></FormRow>
          <FormRow label="Phone *"><FormInput placeholder="+91 XXXXX XXXXX" type="tel" /></FormRow>
          <FormRow label="Experience"><FormInput placeholder="e.g. 10 yrs" /></FormRow>
          <FormRow label="Status"><FormSelect placeholder="Select status" options={STATUS_OPTS} /></FormRow>
        </div>
      </Modal>

      <PageHeader
        title="Doctors"
        subtitle="Manage doctor profiles, specialties, schedules, and daily patient load."
        stats={[{ icon: Stethoscope, value: `${visible.length}`, label: "Doctors" }]}
        action={{ label: "Add Doctor", icon: Plus, onClick: () => setShowModal(true) }}
        dateRange={false}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 655 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by doctor name or specialty..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.map((r) => <DoctorRow key={r.id} row={r} />)}
          </DataTable>
        </div>
      </div>
    </>
  );
}
