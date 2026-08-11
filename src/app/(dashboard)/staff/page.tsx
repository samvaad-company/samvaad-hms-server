"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate, todayIso } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { Users2, Plus, Phone, Mail } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { StaffDTO, StaffAttendanceDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import type { Staff } from "@/types";
import Link from "next/link";

// ─── All Staff ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Staff Member", width: "minmax(150px,1.4fr)" },
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
const MIN_WIDTH = 1180;

function StaffRow({ row, actions }: { row: Staff; actions: RowAction[] }) {
  return (
    <Link href={`/staff/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[#57575f] truncate">{row.role}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.department}</span>
      <div className="flex items-center gap-[5px] min-w-0">
        <Phone size={13} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
        <span className="text-[13px] font-normal text-[#11111c] truncate">{row.phone}</span>
      </div>
      <div className="flex items-center gap-[5px] min-w-0">
        <Mail size={13} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
        <span className="text-[13px] font-normal text-[#57575f] truncate">{row.email}</span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.joinDate)}</span>
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
        <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Roles</p>
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`text-left px-4 py-[9px] rounded-[8px] text-[13px] font-normal transition-colors cursor-pointer ${selectedRole === role ? "bg-[#009598] text-white" : "text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c]"}`}
          >
            {role}
          </button>
        ))}
      </div>
      {/* Permissions matrix */}
      <div className="flex-1 border border-[#dedee1] rounded-[10px] overflow-hidden">
        <div className="px-5 py-3 bg-[#f6f6f6] border-b border-[#dedee1]">
          <h3 className="text-[14px] font-medium text-[#11111c]">Module Permissions — {selectedRole}</h3>
        </div>
        <div className="grid gap-0 overflow-y-auto" style={{ maxHeight: 464 }}>
          {MODULES.map((module, i) => {
            const allowed = perms[selectedRole]?.[module] ?? false;
            return (
              <label key={module} className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#fafafa] transition-colors ${i < MODULES.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                <span className="text-[14px] font-normal text-[#11111c]">{module}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-[12px] font-normal ${allowed ? "text-[#00955c]" : "text-[#57575f]"}`}>
                    {allowed ? "Allowed" : "Restricted"}
                  </span>
                  <button
                    onClick={() => toggle(module)}
                    className={`w-[42px] h-[24px] rounded-full transition-colors relative shrink-0 ${allowed ? "bg-[#009598]" : "bg-[#dedee1]"}`}
                  >
                    <span className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${allowed ? "left-[21px]" : "left-[3px]"}`} />
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

// ─── Attendance ───────────────────────────────────────────────────────────────

const ATTENDANCE_DATA = [
  { name: "Maya Sharma",      role: "Head Nurse",       date: "13 Nov",  in: "7:58 AM",  out: "4:05 PM", hours: "8:07", shift: "Morning", status: "Present" },
  { name: "Arjun Mehta",      role: "Lab Technician",   date: "13 Nov",  in: "8:02 AM",  out: "4:00 PM", hours: "7:58", shift: "Morning", status: "Present" },
  { name: "Priya Nair",       role: "Receptionist",     date: "13 Nov",  in: "9:05 AM",  out: "5:10 PM", hours: "8:05", shift: "Morning", status: "Present" },
  { name: "Kavita Reddy",     role: "Pharmacist",       date: "13 Nov",  in: "—",        out: "—",       hours: "—",    shift: "Morning", status: "Absent"  },
  { name: "Suresh Kumar",     role: "Ward Boy",         date: "13 Nov",  in: "7:45 AM",  out: "3:50 PM", hours: "8:05", shift: "Morning", status: "Present" },
  { name: "Deepika Joshi",    role: "Staff Nurse",      date: "13 Nov",  in: "2:55 PM",  out: "10:58 PM",hours: "8:03", shift: "Evening", status: "Present" },
  { name: "Rohit Sinha",      role: "Admin Staff",      date: "13 Nov",  in: "9:10 AM",  out: "—",       hours: "—",    shift: "Morning", status: "Leave"   },
  { name: "Lakshmi Pillai",   role: "Dietitian",        date: "13 Nov",  in: "10:03 AM", out: "6:00 PM", hours: "7:57", shift: "General", status: "Present" },
  { name: "Vinod Chandra",    role: "Security Guard",   date: "13 Nov",  in: "8:00 AM",  out: "8:00 PM", hours: "12:00",shift: "Day",    status: "Present" },
  { name: "Asha Kumari",      role: "Cleaning Staff",   date: "13 Nov",  in: "6:00 AM",  out: "2:00 PM", hours: "8:00", shift: "Morning", status: "Present" },
];

const ATT_STATUS_CLR: Record<string, string> = {
  Present: "bg-[#dffff3] text-[#00955c]",
  Absent:  "bg-[#ffe9e9] text-[#ff0004]",
  Leave:   "bg-[#fff2e0] text-[#ff9000]",
  Late:    "bg-[#f0f0f0] text-[#57575f]",
};

function AttendanceView({ staff }: { staff: StaffDTO[] }) {
  const [date, setDate] = useState(todayIso());
  const { items: records, reload } = useList<StaffAttendanceDTO>("/staff/attendance", {
    all: true, work_date: date,
  });
  const { run, loading } = useMutation();
  const [notice, setNotice] = useState<string | null>(null);

  const byStaff = new Map(records.map(r => [r.staffId, r]));
  const isToday = date === todayIso();

  async function punch(staffId: number, action: "in" | "out") {
    setNotice(null);
    try {
      await run(() => api.post("/staff/attendance/punch", { staffId, action }));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not record the punch.");
    }
  }

  const present = records.filter(r => r.status === "Present").length;
  const onLeave = staff.filter(s => s.status === "On Leave").length;
  const absent = Math.max(0, staff.length - present - onLeave);

  const hhmm = (mins: number) =>
    mins > 0 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : "—";

  return (
    <div className="flex flex-col" style={{ height: 555 }}>
      {/* Date bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-[#f6f6f6] border-b border-[#dedee1]">
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="h-[34px] bg-white border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
        />
        <div className="flex items-center gap-5 ml-4">
          {[
            { l: "Present", v: present, c: "text-[#00955c]" },
            { l: "Absent", v: absent, c: "text-[#ff0004]" },
            { l: "On Leave", v: onLeave, c: "text-[#ff9000]" },
          ].map(s => (
            <div key={s.l} className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">{s.l}</span>
              <span className={`text-[18px] font-medium leading-none ${s.c}`}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      {notice && (
        <div className="mx-5 mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{notice}</div>
      )}

      {/* Roster */}
      <div className="overflow-y-auto flex-1">
        <div className="grid items-center px-5 h-10 bg-[#f2f3f3] text-[12px] font-medium text-[#11111c]"
          style={{ gridTemplateColumns: "1.6fr 1.2fr 110px 110px 110px 200px" }}>
          <span>Staff Member</span><span>Role</span><span>Punch In</span>
          <span>Punch Out</span><span>Hours</span><span>Action</span>
        </div>
        {staff.map(m => {
          const rec = byStaff.get(m.id);
          return (
            <div key={m.id} className="grid items-center px-5 h-[56px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors"
              style={{ gridTemplateColumns: "1.6fr 1.2fr 110px 110px 110px 200px" }}>
              <span className="text-[13px] font-medium text-[#11111c] truncate">{m.name}</span>
              <span className="text-[13px] text-[#57575f] truncate">{m.role}</span>
              <span className="text-[13px] text-[#11111c]">{rec?.punchIn || "—"}</span>
              <span className="text-[13px] text-[#11111c]">{rec?.punchOut || "—"}</span>
              <span className="text-[13px] text-[#57575f]">{hhmm(rec?.minutes ?? 0)}</span>
              <div className="flex items-center gap-2">
                {!isToday ? (
                  <span className="text-[12px] text-[#57575f]">
                    {rec ? "Recorded" : "No record"}
                  </span>
                ) : !rec ? (
                  <button onClick={() => punch(m.id, "in")} disabled={loading}
                    className="text-[12px] text-white bg-[#009598] px-3 py-[5px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
                    Punch In
                  </button>
                ) : !rec.punchOut ? (
                  <button onClick={() => punch(m.id, "out")} disabled={loading}
                    className="text-[12px] text-[#ff9000] border border-[#ff9000] px-3 py-[5px] rounded-full hover:bg-[#fff2e0] transition-colors disabled:opacity-50">
                    Punch Out
                  </button>
                ) : (
                  <span className="text-[12px] text-[#00955c]">Shift complete</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STAFF_FILTER_MAP: Record<string, string> = { "OnLeave": "On Leave" };

export default function StaffPage() {
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

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Staff Member"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={addStaff} disabled={loading || !form.name || !form.role}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
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
        title="Staff"
        subtitle="Manage hospital staff — nurses, technicians, admin personnel, and support staff."
        stats={[{ icon: Users2, value: `${visible.length}`, label: "Total Staff" }]}
        action={{ label: "Add Staff", icon: Plus, onClick: () => setShowModal(true) }}
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
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No staff found.</div>
                ) : visible.map(r => (
                  <StaffRow key={r.id} row={r} actions={[
                    { label: "View profile", onClick: () => router.push(`/staff/${r.id}`) },
                    { label: r.status === "On Leave" ? "Mark Active" : "Mark On Leave", onClick: () => mutate(() => api.patch(`/staff/${r.id}`, { status: r.status === "On Leave" ? "Active" : "On Leave" })) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.name) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "access"     && <AccessControlView />}
          {tab === "attendance" && <AttendanceView staff={staffMembers} />}
        </div>
      </div>
    </>
  );
}
