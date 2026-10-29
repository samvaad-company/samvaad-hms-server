"use client";

/**
 * A staff member's HR file: profile (ID, qualification, licence, emergency contact), their leave, rostered shifts,
 * salary, documents and the month's attendance. Leave and shifts need "hr"; salary needs "payroll".
 */
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, MapPin, Calendar, GraduationCap, IdCard, ShieldAlert } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useAuth } from "@/lib/auth-context";
import { useItem, useList } from "@/lib/api/hooks";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { HrLeaveRequestDTO, HrLeaveTypeDTO, HrRosterDTO, HrSalaryDTO, HrShiftDTO, HrStaffBalanceDTO, StaffDTO } from "@/types/api";
import { TabBar } from "@/components/shared/TabBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DocumentsPanel } from "@/components/shared/DocumentsPanel";
import { dmy, Empty, outlineBtn, Pill, primaryBtn, softBtn, todayLocal } from "@/components/mrd/shared";
import { addDaysIso, clock12, monthLabel, rupees, weekdayOf } from "@/components/hr/shared";
import { ApplyLeaveDialog, SalaryDialog } from "@/components/hr/HrDialogs";
import { StaffProfileDialog } from "@/components/hr/StaffProfileDialog";
import { shiftTone } from "@/components/hr/RosterViews";
import { AttendanceMonth } from "@/components/hr/AttendanceMonth";

const STAFF_DOC_CATEGORIES = ["ID proof", "Appointment letter", "Qualification certificate", "Licence", "Experience letter", "Contract", "Other"];
const card = `${tw.surface.card} ${tw.radius.card}`;

function daysUntil(iso: string): number {
  return Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${todayLocal()}T00:00:00Z`).getTime()) / 86_400_000);
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canHr = can("hr");
  const canHrWrite = can("hr", "write");
  const canPayroll = can("payroll");
  const canEdit = can("staff", "write");
  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const { item: staff, loading } = useItem<StaffDTO>(`/staff/${id}`);
  useBreadcrumb("/staff", "Staff", staff?.name ?? "Staff Profile");

  if (loading) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p></div>;
  if (!staff) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Staff member not found.</p></div>;

  const TABS = [
    { id: "profile", label: "Profile" },
    ...(canHr ? [{ id: "leave", label: "Leave" }, { id: "shifts", label: "Shifts" }] : []),
    ...(canPayroll ? [{ id: "salary", label: "Salary" }] : []),
    { id: "documents", label: "Documents" },
    { id: "attendance", label: "Attendance" },
  ];
  const left = daysUntil(staff.licenceExpiry ?? "9999-12-31");
  const licenceAlert = staff.licenceExpiry && left <= 60;

  return (
    <div className={`${tw.gutterX} mb-[30px]`}>
      <div className="flex items-start gap-5">
        <div className="flex shrink-0 flex-col gap-4" style={{ width: 280 }}>
          <div className={`${card} flex flex-col items-center gap-3 p-5`}>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--subtle-2)] text-[22px] font-medium text-[color:var(--ink-soft)]">
              {staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="text-center">
              <p className="text-[16px] font-medium text-[color:var(--ink)]">{staff.name}</p>
              <p className="text-[13px] font-light text-[color:var(--ink-soft)]">{staff.role}</p>
              <p className="font-mono text-[12px] text-[color:var(--ink-soft)]">{staff.employeeNo}</p>
            </div>
            <StatusBadge status={staff.status} />
          </div>
          <div className={`${card} flex flex-col gap-3 p-5`}>
            {[
              { icon: Phone, label: "Phone", value: staff.phone },
              { icon: Mail, label: "Email", value: staff.email },
              { icon: MapPin, label: "Address", value: staff.address },
              { icon: Calendar, label: "Date of birth", value: staff.dob ? dmy(staff.dob) : "" },
              { icon: GraduationCap, label: "Qualification", value: staff.qualification },
              { icon: IdCard, label: "Licence", value: staff.licenceNo ? `${staff.licenceNo}${staff.licenceExpiry ? ` · valid to ${dmy(staff.licenceExpiry)}` : ""}` : "" },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon size={13} className="mt-[3px] shrink-0 text-[color:var(--ink-soft)]" strokeWidth={1.5} />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">{row.label}</p>
                  <p className="text-[12px] leading-[16px] text-[color:var(--ink)]">{row.value || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`min-w-0 flex-1 ${card} overflow-hidden`} style={{ minHeight: 500 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "profile" && (
            <div className="flex flex-col gap-4 p-5">
              {licenceAlert && (
                <div role="alert" className="flex items-center gap-2 rounded-[8px] border border-[#f3cf7d] bg-[#fff8e6] px-4 py-3 text-[14px] text-[#8a5300]">
                  <ShieldAlert size={16} /> {left < 0 ? `Licence ${staff.licenceNo} lapsed ${-left} ${-left === 1 ? "day" : "days"} ago (${dmy(staff.licenceExpiry)}).` : `Licence ${staff.licenceNo} lapses ${left === 0 ? "today" : `in ${left} ${left === 1 ? "day" : "days"}`} (${dmy(staff.licenceExpiry)}).`}
                </div>
              )}
              {canEdit && <div className="flex justify-end"><button onClick={() => setEditing(true)} className={outlineBtn + " !h-[36px]"}>Edit profile</button></div>}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Department", value: staff.department },
                  { label: "Role", value: staff.role },
                  { label: "Join date", value: formatDate(staff.joinDate) },
                  { label: "Employee ID", value: staff.employeeNo },
                  { label: "Gender", value: staff.gender },
                  { label: "Emergency contact", value: staff.emergencyName ? `${staff.emergencyName}${staff.emergencyPhone ? ` · ${staff.emergencyPhone}` : ""}` : staff.emergencyPhone },
                ].map((f) => (
                  <div key={f.label} className="rounded-[10px] border border-[color:var(--line)] p-4">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{f.label}</p>
                    <p className="text-[14px] text-[color:var(--ink)]">{f.value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "leave" && canHr && <LeaveTab staff={staff} canWrite={canHrWrite} />}
          {tab === "shifts" && canHr && <ShiftsTab staffId={staff.id} />}
          {tab === "salary" && canPayroll && <SalaryTab staffId={staff.id} canWrite={can("payroll", "write")} />}
          {tab === "documents" && <div className="p-5"><DocumentsPanel ownerType="staff" ownerId={staff.id} categories={STAFF_DOC_CATEGORIES} /></div>}
          {tab === "attendance" && <AttendanceMonth staffId={staff.id} />}
        </div>
      </div>
      {editing && <StaffProfileDialog staff={staff} onClose={() => setEditing(false)} />}
    </div>
  );
}

function LeaveTab({ staff, canWrite }: { staff: StaffDTO; canWrite: boolean }) {
  const year = todayLocal().slice(0, 4);
  const { items: types } = useList<HrLeaveTypeDTO>("/hr/leave-types");
  const { items: balances } = useList<HrStaffBalanceDTO>("/hr/leave/balances", { year });
  const { items: requests } = useList<HrLeaveRequestDTO>("/hr/leave", { staffId: staff.id });
  const [applying, setApplying] = useState(false);
  const mine = balances.find((b) => b.staffId === staff.id)?.balances ?? [];
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">Leave balance — {year}</h3>
        {canWrite && <button onClick={() => setApplying(true)} className={primaryBtn + " ml-auto"}>+ Apply for leave</button>}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {mine.map((b) => (
          <div key={b.typeId} className="rounded-[10px] border border-[color:var(--line)] px-4 py-3">
            <p className="text-[13px] text-[color:var(--ink-soft)]">{b.name}</p>
            <p className="mt-1 font-mono text-[24px] font-bold text-[color:var(--ink)]">{b.allocated > 0 ? b.remaining : b.used}<span className="ml-1 text-[12px] font-normal text-[color:var(--ink-soft)]">{b.allocated > 0 ? `left of ${b.allocated}` : "taken"}</span></p>
            <p className="text-[12px] text-[color:var(--ink-soft)]">{b.allocated > 0 ? `${b.used} taken` : ""}{b.pending > 0 ? `${b.allocated > 0 ? ", " : ""}${b.pending} waiting` : ""}</p>
          </div>
        ))}
      </div>
      <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">Requests</h3>
      {requests.length === 0 ? <Empty>No leave has been requested.</Empty> : (
        <ul className="divide-y divide-[color:var(--line)] rounded-[10px] border border-[color:var(--line)]">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px]">
              <span className="font-medium">{r.typeName}</span>
              <span>{r.fromDate === r.toDate ? dmy(r.fromDate) : `${dmy(r.fromDate)} – ${dmy(r.toDate)}`}</span>
              <span className="text-[color:var(--ink-soft)]">{r.days} {r.days === 1 ? "day" : "days"}</span>
              {r.reason && <span className="truncate text-[color:var(--ink-soft)]">&ldquo;{r.reason}&rdquo;</span>}
              <span className="ml-auto"><Pill>{r.status}</Pill></span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/hr/leave" className={softBtn + " self-start"}>Manage all leave</Link>
      {applying && <ApplyLeaveDialog types={types} presetStaffId={staff.id} onClose={() => setApplying(false)} />}
    </div>
  );
}

function ShiftsTab({ staffId }: { staffId: number }) {
  const today = todayLocal();
  const to = addDaysIso(today, 13);
  const { items: shifts } = useList<HrShiftDTO>("/hr/shifts");
  const { item: roster } = useItem<HrRosterDTO>(`/hr/roster?from=${today}&to=${to}`);
  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i));
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <h3 className="text-[14px] font-semibold text-[color:var(--ink-soft)]">Next two weeks</h3>
        <Link href="/hr/roster" className={softBtn + " ml-auto"}>Open roster</Link>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
        {days.map((d) => {
          const e = roster?.entries.find((x) => x.staffId === staffId && x.date === d);
          const leave = roster?.leaveDays.find((x) => x.staffId === staffId && x.date === d);
          const shift = e ? shifts.find((s) => s.id === e.shiftId) : undefined;
          return (
            <div key={d} className="rounded-[10px] border border-[color:var(--line)] px-3 py-2">
              <p className="text-[12px] text-[color:var(--ink-soft)]">{weekdayOf(d)} {Number(d.slice(8))}{d === today ? " · today" : ""}</p>
              {leave ? <p className="mt-1 text-[13px] text-[#8a5300]">On leave · {leave.code}</p>
                : shift ? <p className="mt-1 text-[13px]"><span className={`rounded-full px-2 py-[1px] text-[12px] ${shiftTone(shifts, shift.id)}`}>{shift.code}</span> <span className="text-[color:var(--ink-soft)]">{clock12(shift.start)}–{clock12(shift.end)}</span></p>
                : <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">Off</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SalaryTab({ staffId, canWrite }: { staffId: number; canWrite: boolean }) {
  const { items, reload } = useList<HrSalaryDTO>("/hr/salaries");
  const [editing, setEditing] = useState(false);
  const s = items.find((x) => x.staffId === staffId);
  if (!s) return <Empty>Loading…</Empty>;
  const rows: [string, string][] = s.set
    ? [["Basic", rupees(s.basic)], ["House rent allowance", rupees(s.hra)], ["Other allowances", rupees(s.allowances)], ["Gross a month", rupees(s.gross)], ["Provident fund", `${s.pfPercent}% of basic`], ["Professional tax", rupees(s.profTax)], ["Other deduction", rupees(s.otherDeduction)]]
    : [];
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">Salary structure</h3>
        <div className="ml-auto flex gap-2">
          <Link href="/hr/payroll" className={outlineBtn + " !h-[36px]"}>Payroll runs</Link>
          {canWrite && <button onClick={() => setEditing(true)} className={primaryBtn}>{s.set ? "Edit salary" : "Set salary"}</button>}
        </div>
      </div>
      {!s.set ? <Empty>No salary has been set, so this person isn&apos;t in payroll.</Empty> : (
        <dl className="divide-y divide-[color:var(--line)] rounded-[10px] border border-[color:var(--line)]">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between px-4 py-3 text-[14px]"><dt className="text-[color:var(--ink-soft)]">{k}</dt><dd className="font-mono font-medium">{v}</dd></div>)}
        </dl>
      )}
      <p className="text-[12px] text-[color:var(--ink-soft)]">Monthly figures. Payslips for {monthLabel(todayLocal().slice(0, 7))} and earlier are under Payroll.</p>
      {editing && <SalaryDialog salary={s} onClose={() => { setEditing(false); reload(); }} />}
    </div>
  );
}
