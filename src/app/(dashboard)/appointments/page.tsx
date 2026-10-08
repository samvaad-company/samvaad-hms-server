"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Download, MonitorPlay, Video } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { AppointmentDTO, OpdRecordDTO, DoctorDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { inDateRange, type DateRangeId, formatDate } from "@/lib/dates";
import Link from "next/link";
import type { Appointment } from "@/types";

// ─── All Appointments ─────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient",  width: "minmax(140px,1.3fr)" },
  { label: "Age",      width: "60px" },
  { label: "Doctor",   width: "minmax(140px,1.3fr)" },
  { label: "Date",     width: "110px" },
  { label: "Time",     width: "90px" },
  { label: "Type",     width: "120px" },
  { label: "Reason",   width: "minmax(150px,1.6fr)" },
  { label: "Status",   width: "120px" },
  { label: "Action",   width: "52px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Today", label: "Today" },
  { id: "Upcoming", label: "Upcoming" }, { id: "Completed", label: "Completed" },
  { id: "Cancelled", label: "Cancelled" },
];
const MIN_WIDTH = 1180;

function AppointmentRow({ row, actions }: { row: Appointment; actions: RowAction[] }) {
  return (
    <Link href={`/appointments/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.patientAge}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.doctor}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[12px] font-light text-[#57575f] whitespace-nowrap">{row.time}</span>
      <div>
        <span className={`inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${
          row.type === "Booked" ? "bg-[#d6eaff] text-[#007cff]" : row.type === "Tele-consult" ? "bg-[#ede7ff] text-[#6a4cff]" : "bg-[#f0f0f0] text-[#57575f]"
        }`}>
          {row.type === "Tele-consult" && <Video size={11} />}
          {row.type}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.reason}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

// ─── Live Queue ───────────────────────────────────────────────────────────────

const QUEUE_COLS = "90px minmax(160px,1.4fr) minmax(150px,1.2fr) 110px 110px 110px minmax(200px,1fr)";

function QueueView({ opdRecords, onCallNext, canCallNext }: { opdRecords: OpdRecordDTO[]; onCallNext: (id: number) => void; canCallNext: boolean }) {
  const waiting = opdRecords.filter(r => r.status === "Waiting").length;
  const inConsult = opdRecords.filter(r => r.status === "In Consultation").length;
  const completed = opdRecords.filter(r => r.status === "Completed").length;

  return (
    <div className="flex flex-col overflow-auto" style={{ height: 555 }}>
      {/* Stats bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#f6f6f6] border-b border-[#dedee1] shrink-0">
        <div className="flex items-center gap-6">
          {[
            { label: "Waiting", value: waiting, color: "text-[#ff9000]" },
            { label: "In Consultation", value: inConsult, color: "text-[#007cff]" },
            { label: "Completed", value: completed, color: "text-[#00955c]" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {i > 0 && <div className="w-px h-5 bg-[#dedee1]" />}
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">{s.label}</span>
              <span className={`text-[22px] font-medium leading-none ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
        <Link href="/queue-board" target="_blank"
          className="flex items-center gap-[6px] text-[13px] font-normal text-[#009598] border border-[#009598] px-4 py-[7px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">
          <MonitorPlay size={14} /> Token Display Board
        </Link>
      </div>
      {/* Queue rows */}
      <div className="overflow-x-auto flex-1">
        <div style={{ minWidth: 1100 }}>
          {/* A CSS grid keeps the header and cells aligned; the previous
              absolute offsets drifted once vitals showed real readings. */}
          <div
            className="grid items-center px-5 h-10 bg-[#f2f3f3] text-[13px] font-medium text-[#11111c]"
            style={{ gridTemplateColumns: QUEUE_COLS }}
          >
            <span>Token #</span><span>Patient</span><span>Doctor</span>
            <span>Wait Time</span><span>Vitals</span><span>Check-in</span><span>Status</span>
          </div>

          {opdRecords.map(row => (
            <div
              key={row.id}
              className="grid items-center px-5 h-[64px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors"
              style={{ gridTemplateColumns: QUEUE_COLS }}
            >
              <span className="text-[15px] font-medium text-[#009598]">{row.tokenNumber}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-medium text-[#11111c] truncate">{row.patientName}</span>
                <span className="text-[11px] font-light text-[#57575f]">{row.patientAge} yrs</span>
              </div>
              <span className="text-[14px] font-normal text-[#11111c] truncate">{row.doctor}</span>
              <span className={`text-[13px] font-normal ${row.waitTime !== "—" ? "text-[#ff9000]" : "text-[#57575f]"}`}>
                {row.waitTime !== "—" ? row.waitTime : "—"}
              </span>
              <div className="min-w-0">
                <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.vitalsRecorded ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`}>
                  {row.vitalsRecorded ? "Recorded" : "Pending"}
                </span>
              </div>
              <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.checkInTime}</span>
              <div className="flex items-center gap-2 min-w-0">
                <StatusBadge status={row.status} />
                {row.status === "Waiting" && canCallNext && (
                  <button
                    onClick={() => onCallNext(row.id)}
                    className="text-[11px] font-medium text-white bg-[#009598] px-3 py-[4px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap"
                  >
                    Call Next
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Doctor-wise Schedule ─────────────────────────────────────────────────────

/** Distinct appointment dates in chronological order, capped for the grid. */
function scheduleDates(appointments: AppointmentDTO[], max = 6): string[] {
  const seen = new Map<string, number>();
  for (const a of appointments) {
    if (a.status === "Cancelled") continue;
    const t = new Date(a.date).getTime();
    if (!seen.has(a.date)) seen.set(a.date, Number.isNaN(t) ? Infinity : t);
  }
  return [...seen.entries()]
    .sort((x, y) => x[1] - y[1])
    .slice(0, max)
    .map(([date]) => date);
}

interface ScheduleCell {
  doctor: string;
  specialty: string;
  date: string;
}

function ScheduleView({ doctors, appointments }: { doctors: DoctorDTO[]; appointments: AppointmentDTO[] }) {
  const dates = scheduleDates(appointments);
  const withAppointments = new Set(appointments.map(a => a.doctor));
  const rows = doctors.filter(d => withAppointments.has(d.name) || d.status !== "On Leave");
  const [openCell, setOpenCell] = useState<ScheduleCell | null>(null);

  const cellAppointments = (doctor: string, date: string) =>
    appointments
      .filter(a => a.doctor === doctor && a.date === date && a.status !== "Cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));

  const dayTimeline = openCell ? cellAppointments(openCell.doctor, openCell.date) : [];

  if (dates.length === 0) {
    return <div className="py-16 text-center text-[14px] text-[#57575f]">No appointments scheduled.</div>;
  }

  return (
    <div className="p-5 overflow-auto" style={{ height: 555 }}>
      <Modal
        open={!!openCell}
        onClose={() => setOpenCell(null)}
        title={openCell ? `${openCell.doctor} — ${openCell.date}` : ""}
      >
        {openCell && (
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-light text-[#57575f] mb-3">
              {openCell.specialty} · {dayTimeline.length} appointment{dayTimeline.length === 1 ? "" : "s"}
            </p>
            {dayTimeline.map(s => (
              <div key={s.id} className="flex items-start gap-3 py-3 border-b border-[#f0f0f0] last:border-0">
                <span className="text-[13px] font-medium text-[#009598] w-[72px] shrink-0 whitespace-nowrap">{s.time}</span>
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-[#11111c]">{s.patientName}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  {s.reason && <span className="text-[12px] font-light text-[#57575f]">{s.reason}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <div style={{ minWidth: 900 }}>
        {/* Header */}
        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `200px repeat(${dates.length}, 1fr)` }}>
          <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider py-2">Doctor</div>
          {dates.map(d => (
            <div key={d} className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider text-center py-2 whitespace-nowrap">{d}</div>
          ))}
        </div>
        {/* Doctor rows */}
        {rows.map(doc => (
          <div key={doc.id} className="grid gap-2 mb-2 border-b border-[#f0f0f0] pb-2" style={{ gridTemplateColumns: `200px repeat(${dates.length}, 1fr)` }}>
            <div className="flex flex-col gap-[2px] py-2">
              <span className="text-[13px] font-medium text-[#11111c] leading-4 whitespace-nowrap">{doc.name}</span>
              <span className="text-[11px] font-light text-[#57575f]">{doc.specialty}</span>
              {doc.status === "On Leave" && (
                <span className="text-[10px] font-medium text-[#ff0004]">On Leave</span>
              )}
            </div>
            {dates.map(date => {
              const slots = cellAppointments(doc.name, date);
              const onLeave = doc.status === "On Leave";
              const clickable = !onLeave && slots.length > 0;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && setOpenCell({ doctor: doc.name, specialty: doc.specialty, date })}
                  className={`rounded-[8px] p-2 text-center transition-colors ${
                    onLeave ? "bg-[#ffe9e9]" : slots.length > 0 ? "bg-[#e8f7f7] hover:bg-[#d7f0f0] cursor-pointer" : "bg-[#f6f6f6] cursor-default"
                  }`}
                >
                  {onLeave ? (
                    <span className="text-[10px] font-medium text-[#ff0004]">On Leave</span>
                  ) : slots.length === 0 ? (
                    <span className="text-[10px] font-normal text-[#57575f]">Free</span>
                  ) : (
                    <span className="text-[11px] font-medium text-[#009598]">{slots.length} appt{slots.length > 1 ? "s" : ""}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { can } = useAuth();
  const canWrite = can("appointments", "write");
  const canOpdWrite = can("opd", "write");
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRangeId>("all");

  const router = useRouter();
  const { items: appointments, reload } = useList<AppointmentDTO>("/appointments", { all: true });
  const { items: opdRecords, reload: reloadOpd } = useList<OpdRecordDTO>("/opd", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { dialog, remove, mutate } = useRowActions("appointments", reload);
  const { run: runQueue } = useMutation();
  const [notice, setNotice] = useState<string | null>(null);

  /** Issue an OPD token for a booked appointment. */
  async function checkIn(appt: AppointmentDTO) {
    setNotice(null);
    try {
      const visit = await api.post<OpdRecordDTO>(`/appointments/${appt.id}/check-in`);
      setNotice(`${appt.patientName} checked in to OPD as ${visit.tokenNumber}.`);
      reload();
      reloadOpd();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not check in this appointment.");
    }
  }

  const callNext = (opdId: number) =>
    runQueue(() => api.patch(`/opd/${opdId}`, { status: "In Consultation" })).then(reloadOpd);

  const TABS = [
    { id: "all",      label: "All Appointments", count: appointments.length },
    { id: "queue",    label: "Live Queue",        count: opdRecords.filter(r => r.status === "Waiting").length },
    { id: "schedule", label: "Doctor Wise" },
  ];

  /** Download the (filtered) appointment list as CSV. */
  function exportCsv() {
    const header = ["Patient", "Age", "Doctor", "Date", "Time", "Type", "Reason", "Status"];
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...visible.map(r =>
        [r.patientName, r.patientAge, r.doctor, r.date, r.time, r.type, r.reason, r.status]
          .map(escape).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visible = appointments.filter(r => {
    const matchF = filter === "All" || r.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || r.patientName.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q);
    return matchF && matchS && inDateRange(r.date, range);
  });

  return (
    <>
      {dialog}
      <PageHeader
        title="Appointments"
        subtitle="Manage appointments, track the live OPD queue, and view doctor schedules."
        stats={[{ icon: Calendar, value: `${visible.length}`, label: "Appointments" }]}
        action={canWrite ? { label: "New Appointment", icon: Plus, onClick: () => router.push("/appointments/new") } : undefined}
        range={range}
        onRangeChange={setRange}
      />
      {notice && (
        <div className={`${tw.gutterX} mb-3`}>
          <div className="flex items-start justify-between gap-3 text-[13px] text-[#11111c] bg-[#e8f7f7] border border-[#b8e5e6] rounded-[10px] px-4 py-3">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-[#57575f] hover:text-[#11111c] shrink-0">✕</button>
          </div>
        </div>
      )}

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "all" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by patient name or doctor..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch}
                action={{ label: "Export CSV", icon: Download, onClick: exportCsv }} />
              <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No appointments found.</div>
                ) : visible.map(r => (
                  <AppointmentRow key={r.id} row={r} actions={[
                    { label: "View details", onClick: () => router.push(`/appointments/${r.id}`) },
                    ...(r.type === "Tele-consult" && r.videoUrl ? [{ label: "Join video call", onClick: () => window.open(r.videoUrl!, "_blank", "noopener,noreferrer") }] : []),
                    ...(canWrite ? [
                      { label: "Check in to OPD", disabled: r.status === "Cancelled" || r.status === "Completed", onClick: () => void checkIn(r) },
                      { label: "Mark Completed", disabled: r.status === "Completed", onClick: () => mutate(() => api.patch(`/appointments/${r.id}`, { status: "Completed" })) },
                      { label: "Cancel appointment", disabled: r.status === "Cancelled", onClick: () => mutate(() => api.patch(`/appointments/${r.id}`, { status: "Cancelled" })) },
                      { label: "Delete", danger: true, onClick: () => remove(r.id, r.patientName) },
                    ] : []),
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "queue"    && <QueueView opdRecords={opdRecords} onCallNext={callNext} canCallNext={canOpdWrite} />}
          {tab === "schedule" && <ScheduleView doctors={doctors} appointments={appointments} />}
        </div>
      </div>
    </>
  );
}
