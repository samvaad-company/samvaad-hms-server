"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Download, MonitorPlay } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { AppointmentDTO, OpdRecordDTO, DoctorDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import Link from "next/link";
import type { Appointment } from "@/types";

// ─── All Appointments ─────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient",  width: "minmax(140px,1.3fr)" },
  { label: "Age",      width: "60px" },
  { label: "Doctor",   width: "minmax(140px,1.3fr)" },
  { label: "Date",     width: "110px" },
  { label: "Time",     width: "90px" },
  { label: "Type",     width: "100px" },
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
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.date}</span>
      <span className="text-[12px] font-light text-[#57575f] whitespace-nowrap">{row.time}</span>
      <div>
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.type === "Booked" ? "bg-[#d6eaff] text-[#007cff]" : "bg-[#f0f0f0] text-[#57575f]"}`}>
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

function QueueView({ opdRecords, onCallNext }: { opdRecords: OpdRecordDTO[]; onCallNext: (id: number) => void }) {
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
        <div style={{ minWidth: 1200 }}>
          {/* header */}
          <div className="relative h-10 bg-[#f2f3f3]" style={{ minWidth: 1200 }}>
            {[
              { label: "Token #", left: 20 }, { label: "Patient", left: 110 },
              { label: "Doctor", left: 360 }, { label: "Wait Time", left: 600 },
              { label: "Vitals", left: 760 }, { label: "Check-in", left: 930 },
              { label: "Status", left: 1060 },
            ].map(c => (
              <span key={c.label} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.left }}>{c.label}</span>
            ))}
          </div>
          {opdRecords.map(row => (
            <div key={row.id} className={tw.table.dataRow} style={{ minWidth: 1200 }}>
              <div className="absolute left-5">
                <span className="text-[16px] font-medium text-[#009598]">{row.tokenNumber}</span>
              </div>
              <div className="absolute flex flex-col justify-center" style={{ left: 110 }}>
                <span className="text-[14px] font-medium text-[#11111c] whitespace-nowrap">{row.patientName}</span>
                <span className="text-[12px] font-light text-[#57575f]">{row.patientAge} yrs</span>
              </div>
              <div className="absolute" style={{ left: 360 }}>
                <span className="text-[14px] font-normal text-[#11111c] whitespace-nowrap">{row.doctor}</span>
              </div>
              <div className="absolute" style={{ left: 600 }}>
                <span className={`text-[14px] font-normal ${row.waitTime !== "—" ? "text-[#ff9000]" : "text-[#57575f]"}`}>
                  {row.waitTime !== "—" ? row.waitTime : "—"}
                </span>
              </div>
              <div className="absolute" style={{ left: 760 }}>
                <span className={`inline-flex px-[8px] py-[4px] rounded-full text-[11px] font-normal ${row.vitalsRecorded ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`}>
                  {row.vitalsRecorded ? "Recorded" : "Pending"}
                </span>
              </div>
              <div className="absolute" style={{ left: 930 }}>
                <span className="text-[14px] font-normal text-[#11111c]">{row.checkInTime}</span>
              </div>
              <div className="absolute flex items-center gap-2" style={{ left: 1060 }}>
                <StatusBadge status={row.status} />
                {row.status === "Waiting" && (
                  <button onClick={() => onCallNext(row.id)} className="text-[11px] font-medium text-white bg-[#009598] px-3 py-[4px] rounded-full hover:bg-[#007f82] transition-colors ml-2 whitespace-nowrap">
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

function ScheduleView({ doctors, appointments }: { doctors: DoctorDTO[]; appointments: AppointmentDTO[] }) {
  const dates = scheduleDates(appointments);
  const withAppointments = new Set(appointments.map(a => a.doctor));
  const rows = doctors.filter(d => withAppointments.has(d.name) || d.status !== "On Leave");

  const cellAppointments = (doctor: string, date: string) =>
    appointments
      .filter(a => a.doctor === doctor && a.date === date && a.status !== "Cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));

  if (dates.length === 0) {
    return <div className="py-16 text-center text-[14px] text-[#57575f]">No appointments scheduled.</div>;
  }

  return (
    <div className="p-5 overflow-auto" style={{ height: 555 }}>
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
              return (
                <div key={date} className={`rounded-[8px] p-2 text-center ${onLeave ? "bg-[#ffe9e9]" : slots.length > 0 ? "bg-[#e8f7f7]" : "bg-[#f6f6f6]"}`}>
                  {onLeave ? (
                    <span className="text-[10px] font-medium text-[#ff0004]">On Leave</span>
                  ) : slots.length === 0 ? (
                    <span className="text-[10px] font-normal text-[#57575f]">Free</span>
                  ) : (
                    <>
                      <div className="text-[11px] font-medium text-[#009598]">{slots.length} appt{slots.length > 1 ? "s" : ""}</div>
                      <div className="text-[10px] font-normal text-[#009598] mt-[2px] truncate">
                        {slots.slice(0, 3).map(s => s.time).join(" · ")}{slots.length > 3 ? " …" : ""}
                      </div>
                    </>
                  )}
                </div>
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
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const router = useRouter();
  const { items: appointments, reload } = useList<AppointmentDTO>("/appointments", { all: true });
  const { items: opdRecords, reload: reloadOpd } = useList<OpdRecordDTO>("/opd", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run: runBook, loading: booking, error: bookError } = useMutation();
  const { dialog, remove, mutate } = useRowActions("appointments", reload);
  const { run: runQueue } = useMutation();
  const callNext = (opdId: number) =>
    runQueue(() => api.patch(`/opd/${opdId}`, { status: "In Consultation" })).then(reloadOpd);

  const [book, setBook] = useState({ patientId: "", doctorId: "", date: "", slot: "", type: "Booked", reason: "" });
  const setB = (k: keyof typeof book, v: string) => setBook(prev => ({ ...prev, [k]: v }));

  async function confirmBooking() {
    const patient = patients.find(p => String(p.id) === book.patientId);
    await runBook(() =>
      api.post("/appointments", {
        patientId: Number(book.patientId),
        patientName: patient?.name ?? "",
        patientAge: patient?.age ?? 0,
        doctorId: book.doctorId ? Number(book.doctorId) : undefined,
        date: book.date,
        time: book.slot,
        type: book.type,
        reason: book.reason,
        status: "Upcoming",
      }),
    );
    setBook({ patientId: "", doctorId: "", date: "", slot: "", type: "Booked", reason: "" });
    setShowModal(false);
    reload();
  }

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
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Book Appointment"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <Link href="/appointments/new" onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Full Form →</Link>
            <button onClick={confirmBooking} disabled={booking || !book.patientId || !book.date || !book.slot}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {booking ? "Booking…" : "Confirm Booking"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient *"><FormSelect placeholder="Search patient" value={book.patientId} onChange={v => setB("patientId", v)} options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} /></FormRow>
          <FormRow label="Doctor *"><FormSelect placeholder="Select doctor" value={book.doctorId} onChange={v => setB("doctorId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} /></FormRow>
          <FormRow label="Date *"><FormInput type="date" value={book.date} onChange={v => setB("date", v)} /></FormRow>
          <FormRow label="Time Slot *"><FormSelect placeholder="Select slot" value={book.slot} onChange={v => setB("slot", v)} options={["9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","4:00 PM","4:30 PM","5:00 PM"].map(t => ({ value: t, label: t }))} /></FormRow>
          <FormRow label="Type"><FormSelect placeholder="Select type" value={book.type} onChange={v => setB("type", v)} options={[{ value: "Booked", label: "Booked" }, { value: "Walk-in", label: "Walk-in" }]} /></FormRow>
          <FormRow label="Reason"><FormInput placeholder="Brief reason for visit" value={book.reason} onChange={v => setB("reason", v)} /></FormRow>
          {bookError && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{bookError.message}</div>}
        </div>
      </Modal>

      <PageHeader
        title="Appointments"
        subtitle="Manage appointments, track the live OPD queue, and view doctor schedules."
        stats={[{ icon: Calendar, value: `${visible.length}`, label: "Appointments" }]}
        action={{ label: "New Appointment", icon: Plus, onClick: () => setShowModal(true) }}
      />
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
                    { label: "Mark Completed", disabled: r.status === "Completed", onClick: () => mutate(() => api.patch(`/appointments/${r.id}`, { status: "Completed" })) },
                    { label: "Cancel appointment", disabled: r.status === "Cancelled", onClick: () => mutate(() => api.patch(`/appointments/${r.id}`, { status: "Cancelled" })) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.patientName) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "queue"    && <QueueView opdRecords={opdRecords} onCallNext={callNext} />}
          {tab === "schedule" && <ScheduleView doctors={doctors} appointments={appointments} />}
        </div>
      </div>
    </>
  );
}
