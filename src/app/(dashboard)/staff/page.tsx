"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { Users2, Plus, Phone, Mail } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { StaffDTO } from "@/types/api";
import { AttendanceBoard } from "@/components/attendance/AttendanceBoard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import type { Staff } from "@/types";
import Link from "next/link";

// ─── All Staff ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Staff Member", width: "minmax(150px,1.4fr)" },
  { label: "Employee ID",  width: "100px" },
  { label: "Role",         width: "minmax(120px,1.1fr)" },
  { label: "Department",   width: "minmax(120px,1fr)" },
  { label: "Phone",        width: "150px" },
  { label: "Email",        width: "minmax(160px,1.5fr)" },
  { label: "Join Date",    width: "110px" },
  { label: "Status",       width: "110px" },
  { label: "Action",       width: "52px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Active", label: "Active" },
  { id: "OnLeave", label: "On Leave" }, { id: "Inactive", label: "Inactive" },
];
const MIN_WIDTH = 1290;

function StaffRow({ row, actions }: { row: Staff; actions: RowAction[] }) {
  return (
    <Link href={`/staff/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{row.name}</span>
      <span className="font-mono text-[12px] text-[color:var(--ink-soft)] truncate">{(row as StaffDTO).employeeNo}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)] truncate">{row.role}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.department}</span>
      <div className="flex items-center gap-[5px] min-w-0">
        <Phone size={13} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
        <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.phone}</span>
      </div>
      <div className="flex items-center gap-[5px] min-w-0">
        <Mail size={13} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
        <span className="text-[13px] font-normal text-[color:var(--ink-soft)] truncate">{row.email}</span>
      </div>
      <span className="text-[13px] font-normal text-[color:var(--ink)] whitespace-nowrap">{formatDate(row.joinDate)}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

// ─── Access Control ───────────────────────────────────────────────────────────

const ROLES = ["Administrator", "Doctor", "Nurse", "Lab Technician", "Pharmacist", "Receptionist", "Accountant"];
const MODULES = ["Patients", "Appointments", "OPD", "Prescriptions", "Pharmacy", "Lab", "IPD", "OT", "Beds", "Billing", "Staff", "Reports", "Admin"];

const DEFAULT_PERMS: Record<string, Record<string, boolean>> = {
  Administrator: Object.fromEntries(MODULES.map(m => [m, true])),
  Doctor:        Object.fromEntries(MODULES.map(m => [m, ["Patients","Appointments","OPD","Prescriptions","IPD","Lab"].includes(m)])),
  Nurse:         Object.fromEntries(MODULES.map(m => [m, ["Patients","IPD","OT","Beds","Lab"].includes(m)])),
  "Lab Technician": Object.fromEntries(MODULES.map(m => [m, ["Patients","Lab"].includes(m)])),
  Pharmacist:    Object.fromEntries(MODULES.map(m => [m, ["Patients","Pharmacy","Prescriptions"].includes(m)])),
  Receptionist:  Object.fromEntries(MODULES.map(m => [m, ["Patients","Appointments","Billing"].includes(m)])),
  Accountant:    Object.fromEntries(MODULES.map(m => [m, ["Billing","Reports"].includes(m)])),
};

function AccessControlView() {
  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [selectedRole, setSelectedRole] = useState("Administrator");

  const toggle = (module: string) => setPerms(prev => ({
    ...prev,
    [selectedRole]: { ...prev[selectedRole], [module]: !prev[selectedRole][module] },
  }));

  return (
    <div className="p-5 flex gap-5" style={{ height: 555 }}>
      {/* Role list */}
      <div className="w-48 flex flex-col gap-1 shrink-0">
        <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">Roles</p>
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`text-left px-4 py-[9px] rounded-[8px] text-[13px] font-normal transition-colors cursor-pointer ${selectedRole === role ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)]"}`}
          >
            {role}
          </button>
        ))}
      </div>
      {/* Permissions matrix */}
      <div className="flex-1 border border-[color:var(--line)] rounded-[10px] overflow-hidden">
        <div className="px-5 py-3 bg-[color:var(--subtle)] border-b border-[color:var(--line)]">
          <h3 className="text-[14px] font-medium text-[color:var(--ink)]">Module Permissions — {selectedRole}</h3>
        </div>
        <div className="grid gap-0 overflow-y-auto" style={{ maxHeight: 464 }}>
          {MODULES.map((module, i) => {
            const allowed = perms[selectedRole]?.[module] ?? false;
            return (
              <label key={module} className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[color:var(--faint)] transition-colors ${i < MODULES.length - 1 ? "border-b border-[color:var(--subtle-2)]" : ""}`}>
                <span className="text-[14px] font-normal text-[color:var(--ink)]">{module}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-[12px] font-normal ${allowed ? "text-[#00955c]" : "text-[color:var(--ink-soft)]"}`}>
                    {allowed ? "Allowed" : "Restricted"}
                  </span>
                  <button
                    onClick={() => toggle(module)}
                    className={`w-[42px] h-[24px] rounded-full transition-colors relative shrink-0 ${allowed ? "bg-[color:var(--brand)]" : "bg-[color:var(--line)]"}`}
                  >
                    <span className={`absolute top-[3px] w-[18px] h-[18px] bg-[color:var(--surface)] rounded-full shadow transition-all ${allowed ? "left-[21px]" : "left-[3px]"}`} />
                  </button>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STAFF_FILTER_MAP: Record<string, string> = { "OnLeave": "On Leave" };

export default function StaffPage() {
  const { can } = useAuth();
  const canWrite = can("staff", "write");
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const { items: staffMembers, reload } = useList<StaffDTO>("/staff", { all: true });
  const { run, loading, error } = useMutation();
  const { dialog, remove, mutate } = useRowActions("staff", reload);

  const [form, setForm] = useState({ name: "", role: "", department: "", phone: "", email: "", status: "Active" });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function addStaff() {
    await run(() =>
      api.post("/staff", {
        name: form.name,
        role: form.role,
        department: form.department,
        phone: form.phone,
        email: form.email,
        status: form.status,
      }),
    );
    setForm({ name: "", role: "", department: "", phone: "", email: "", status: "Active" });
    setShowModal(false);
    reload();
  }

  const TABS = [
    { id: "all",        label: "All Staff",       count: staffMembers.length },
    { id: "access",     label: "Access Control" },
    { id: "attendance", label: "Attendance" },
  ];

  const visible = staffMembers.filter(s => {
    const matchF = filter === "All" || s.status === (STAFF_FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
    return matchF && matchS;
  });

  const { rows: pagedVisible, bar: barVisible } = usePagination(visible, "staff");

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Staff Member"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
            <button onClick={addStaff} disabled={loading || !form.name || !form.role}
              className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {loading ? "Adding…" : "Add Staff"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Full Name *"><FormInput placeholder="Name" value={form.name} onChange={v => set("name", v)} /></FormRow>
          <FormRow label="Role *"><FormInput placeholder="e.g. Staff Nurse" value={form.role} onChange={v => set("role", v)} /></FormRow>
          <FormRow label="Department"><FormInput placeholder="e.g. ICU" value={form.department} onChange={v => set("department", v)} /></FormRow>
          <FormRow label="Phone"><FormInput placeholder="+91 XXXXX XXXXX" type="tel" value={form.phone} onChange={v => set("phone", v)} /></FormRow>
          <div className="col-span-2"><FormRow label="Email"><FormInput placeholder="email@samvaad.in" type="email" value={form.email} onChange={v => set("email", v)} /></FormRow></div>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      <PageHeader
        title="Staff directory"
        subtitle="HR · the people on the books — nurses, technicians, admin and support staff. Leave, shifts and payroll are under HR."
        stats={[{ icon: Users2, value: `${visible.length}`, label: "Total Staff" }]}
        action={canWrite ? { label: "Add Staff", icon: Plus, onClick: () => setShowModal(true) } : undefined}
        dateRange={false}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "all" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by name, role, or department..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No staff found.</div>
                ) : pagedVisible.map(r => (
                  <StaffRow key={r.id} row={r} actions={[
                    { label: "View profile", onClick: () => router.push(`/staff/${r.id}`) },
                    ...(canWrite ? [
                      { label: r.status === "On Leave" ? "Mark Active" : "Mark On Leave (manual)", onClick: () => mutate(() => api.patch(`/staff/${r.id}`, { status: r.status === "On Leave" ? "Active" : "On Leave" })) },
                      { label: "Delete", danger: true, onClick: () => remove(r.id, r.name) },
                    ] : []),
                  ]} />
                ))}
              </DataTable>
{barVisible}
            </>
          )}
          {tab === "access"     && <AccessControlView />}
          {tab === "attendance" && <AttendanceBoard canWrite={canWrite} />}
        </div>
      </div>
    </>
  );
}
