"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { useRouter } from "next/navigation";
import { Stethoscope, Plus, Phone } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { DoctorDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import Link from "next/link";
import type { Doctor } from "@/types";

const COLUMNS = [
  { label: "Doctor",         width: "minmax(150px,1.4fr)" },
  { label: "Specialty",      width: "minmax(150px,1.3fr)" },
  { label: "Phone",          width: "150px" },
  { label: "Department",     width: "minmax(120px,1fr)" },
  { label: "Experience",     width: "100px" },
  { label: "Patients Today", width: "120px", align: "center" as const },
  { label: "Status",         width: "110px" },
  { label: "Action",         width: "52px", align: "right" as const },
];

const FILTERS = [
  { id: "All",      label: "All" },
  { id: "Active",   label: "Active" },
  { id: "InOPD",    label: "In OPD" },
  { id: "OnLeave",  label: "On Leave" },
];

const FILTER_MAP: Record<string, string> = { "InOPD": "In OPD", "OnLeave": "On Leave" };
const MIN_WIDTH = 1120;

function DoctorRow({ row, actions }: { row: Doctor; actions: RowAction[] }) {
  return (
    <Link href={`/doctors/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[#57575f] truncate">{row.specialty}</span>
      <div className="flex items-center gap-[5px] min-w-0">
        <Phone size={14} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
        <span className="text-[13px] font-normal text-[#11111c] truncate">{row.phone}</span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.department}</span>
      <span className="text-[13px] font-normal text-[#11111c]">{row.experience}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-center">{row.patientsToday}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

const SPECIALTY_OPTS = ["General Physician","Paediatrician","Cardiologist","Neurologist","Orthopaedic Surgeon","Dermatologist","Gastroenterologist","Endocrinologist","Pulmonologist","Physiotherapist"].map(s => ({ value: s, label: s }));
const DEPT_OPTS = ["OPD","Paediatrics","Cardiology","Neurology","Ortho","Skin","Surgery","Internal Med","Respiratory","Rehab"].map(d => ({ value: d, label: d }));
const STATUS_OPTS = [{ value: "Active", label: "Active" }, { value: "In OPD", label: "In OPD" }, { value: "On Leave", label: "On Leave" }];

export default function DoctorsPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const { items: doctors, reload } = useList<DoctorDTO>("/doctors", { all: true });
  const { run, loading, error } = useMutation();
  const { dialog, remove, mutate } = useRowActions("doctors", reload);

  const [form, setForm] = useState({ name: "", specialty: "", department: "", phone: "", experience: "", status: "Active" });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function addDoctor() {
    await run(() =>
      api.post("/doctors", {
        name: form.name,
        specialty: form.specialty,
        department: form.department,
        phone: form.phone,
        experience: form.experience,
        status: form.status,
      }),
    );
    setForm({ name: "", specialty: "", department: "", phone: "", experience: "", status: "Active" });
    setShowModal(false);
    reload();
  }

  const visible = doctors.filter(d => {
    const matchF = filter === "All" || d.status === (FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.department.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Doctor"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={addDoctor} disabled={loading || !form.name}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Adding…" : "Add Doctor"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormRow label="Full Name *"><FormInput placeholder="Dr. First Last" value={form.name} onChange={v => set("name", v)} /></FormRow></div>
          <FormRow label="Specialty *"><FormSelect placeholder="Select specialty" value={form.specialty} onChange={v => set("specialty", v)} options={SPECIALTY_OPTS} /></FormRow>
          <FormRow label="Department *"><FormSelect placeholder="Select dept" value={form.department} onChange={v => set("department", v)} options={DEPT_OPTS} /></FormRow>
          <FormRow label="Phone *"><FormInput placeholder="+91 XXXXX XXXXX" type="tel" value={form.phone} onChange={v => set("phone", v)} /></FormRow>
          <FormRow label="Experience"><FormInput placeholder="e.g. 10 yrs" value={form.experience} onChange={v => set("experience", v)} /></FormRow>
          <FormRow label="Status"><FormSelect placeholder="Select status" value={form.status} onChange={v => set("status", v)} options={STATUS_OPTS} /></FormRow>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
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
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by doctor name or specialty..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[#57575f]">No doctors found.</div>
            ) : visible.map((r) => (
              <DoctorRow key={r.id} row={r} actions={[
                { label: "View details", onClick: () => router.push(`/doctors/${r.id}`) },
                { label: "Open dashboard", onClick: () => router.push(`/doctors/dashboard`) },
                { label: r.status === "On Leave" ? "Mark Active" : "Mark On Leave", onClick: () => mutate(() => api.patch(`/doctors/${r.id}`, { status: r.status === "On Leave" ? "Active" : "On Leave" })) },
                { label: "Delete", danger: true, onClick: () => remove(r.id, r.name) },
              ]} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
