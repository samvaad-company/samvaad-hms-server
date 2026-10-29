"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { useRouter } from "next/navigation";
import { Stethoscope, Plus, Phone } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { DoctorDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { DoctorFormModal } from "@/components/doctors/DoctorFormModal";
import Link from "next/link";
import type { Doctor } from "@/types";

const COLUMNS = [
  { label: "Doctor",         width: "minmax(150px,1.4fr)" },
  { label: "Specialty",      width: "minmax(150px,1.3fr)" },
  { label: "Phone",          width: "150px", hideBelow: 860 },
  { label: "Department",     width: "minmax(120px,1fr)", hideBelow: 980 },
  { label: "Experience",     width: "100px", hideBelow: 1100 },
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
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)] truncate">{row.specialty}</span>
      <div className="flex items-center gap-[5px] min-w-0">
        <Phone size={14} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
        <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.phone}</span>
      </div>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.department}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)]">{row.experience}</span>
      <span className="text-[13px] font-medium text-[color:var(--ink)] text-center">{row.patientsToday}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

export default function DoctorsPage() {
  const { can, user } = useAuth();
  const canWrite = can("doctors", "write");
  // Front-desk staff don't need the per-doctor personal dashboard shortcut.
  const showOpenDashboard = user?.role !== "Receptionist";
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DoctorDTO | null>(null);
  const router = useRouter();
  const { items: doctors, reload } = useList<DoctorDTO>("/doctors", { all: true });
  const { dialog, remove, mutate } = useRowActions("doctors", reload);

  const visible = doctors.filter(d => {
    const matchF = filter === "All" || d.status === (FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.department.toLowerCase().includes(q);
    return matchF && matchS;
  });

  const { rows: pagedVisible, bar: barVisible } = usePagination(visible, "doctors");

  return (
    <>
      {dialog}
      <DoctorFormModal
        open={showModal || !!editing}
        doctor={editing}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSaved={reload}
      />

      <PageHeader
        title="Doctors"
        subtitle="Manage doctor profiles, specialties, schedules, and daily patient load."
        stats={[{ icon: Stethoscope, value: `${visible.length}`, label: "Doctors" }]}
        action={canWrite ? { label: "Add Doctor", icon: Plus, onClick: () => setShowModal(true) } : undefined}
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
              <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No doctors found.</div>
            ) : pagedVisible.map((r) => (
              <DoctorRow key={r.id} row={r} actions={[
                { label: "View details", onClick: () => router.push(`/doctors/${r.id}`) },
                ...(showOpenDashboard ? [{ label: "Open dashboard", onClick: () => router.push(`/doctors/dashboard`) }] : []),
                ...(canWrite ? [
                  { label: "Edit details", onClick: () => setEditing(r) },
                  { label: "Mark Active", disabled: r.status === "Active", onClick: () => mutate(() => api.patch(`/doctors/${r.id}`, { status: "Active" })) },
                  { label: "Mark In OPD", disabled: r.status === "In OPD", onClick: () => mutate(() => api.patch(`/doctors/${r.id}`, { status: "In OPD" })) },
                  { label: "Mark On Leave", disabled: r.status === "On Leave", onClick: () => mutate(() => api.patch(`/doctors/${r.id}`, { status: "On Leave" })) },
                  { label: "Delete", danger: true, onClick: () => remove(r.id, r.name) },
                ] : []),
              ]} />
            ))}
          </DataTable>
{barVisible}
        </div>
      </div>
    </>
  );
}
