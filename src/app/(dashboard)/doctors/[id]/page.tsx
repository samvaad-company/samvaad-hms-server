"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { ArrowLeft, Pencil, Phone, Mail, Calendar, Clock, Star, Users, TrendingUp, Award } from "lucide-react";
import { useItem, useList } from "@/lib/api/hooks";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { DoctorDTO, AppointmentDTO, OpdRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { DoctorFormModal } from "@/components/doctors/DoctorFormModal";
import { DoctorScheduleEditor } from "@/components/scheduling/DoctorScheduleEditor";


function StatCard({ icon: Icon, value, label, color }: { icon: typeof Users; value: string; label: string; color: string }) {
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0`} style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-[22px] font-medium text-[color:var(--ink)] leading-none">{value}</div>
        <div className="text-[12px] font-normal text-[color:var(--ink-soft)] mt-1">{label}</div>
      </div>
    </div>
  );
}

function ScheduleTab({ doctorId }: { doctorId: number }) {
  const { user, can } = useAuth();
  // The doctor themselves, or an administrator, may change it; everyone else just sees it.
  const canEdit = (user?.role === "Doctor" && user.doctorId === doctorId) || can("doctors", "write");
  return <DoctorScheduleEditor doctorId={doctorId} canEdit={canEdit} />;
}

function TodayPatientsTab({ doctorName, queue }: { doctorName: string; queue: OpdRecordDTO[] }) {
  const todays = queue.filter(r => r.doctor === doctorName);
  if (todays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[color:var(--ink-soft)]">
        <Users size={40} strokeWidth={1} className="mb-3 opacity-30" />
        <span className="text-[14px]">No patients scheduled today</span>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[color:var(--subtle-2)]">
      {todays.map(r => (
        <div key={r.id} className="flex items-center gap-4 px-6 py-4">
          <span className="text-[16px] font-medium text-[color:var(--brand)] w-14">{r.tokenNumber}</span>
          <div className="flex-1">
            <div className="text-[14px] font-medium text-[color:var(--ink)]">{r.patientName}</div>
            <div className="text-[12px] font-light text-[color:var(--ink-soft)]">{r.patientAge} yrs · Check-in {r.checkInTime}</div>
          </div>
          <StatusBadge status={r.status} />
        </div>
      ))}
    </div>
  );
}

function PerformanceTab({ doc, appointments }: { doc: DoctorDTO; appointments: AppointmentDTO[] }) {
  const completed = appointments.filter(a => a.doctor === doc.name && a.status === "Completed").length;
  const total = appointments.filter(a => a.doctor === doc.name).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { label: "Total Appointments", value: String(total) },
    { label: "Completed", value: String(completed) },
    { label: "Completion Rate", value: `${rate}%` },
    { label: "Patients Today", value: String(doc.patientsToday) },
  ];

  return (
    <div className="p-6 grid grid-cols-2 gap-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-[12px] border border-[color:var(--line)] p-5">
          <div className="text-[28px] font-medium text-[color:var(--brand)]">{s.value}</div>
          <div className="text-[13px] font-normal text-[color:var(--ink-soft)] mt-1">{s.label}</div>
        </div>
      ))}
      <div className="col-span-2 rounded-[12px] border border-[color:var(--line)] p-5">
        <div className="text-[12px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-3">Completion Rate</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-[color:var(--subtle-3)] rounded-full overflow-hidden">
            <div className="h-full bg-[color:var(--brand)] rounded-full transition-all" style={{ width: `${rate}%` }} />
          </div>
          <span className="text-[14px] font-medium text-[color:var(--brand)]">{rate}%</span>
        </div>
      </div>
    </div>
  );
}

const TABS = ["Schedule", "Today's Patients", "Performance"] as const;

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item: doc, loading, reload } = useItem<DoctorDTO>(`/doctors/${id}`);
  useBreadcrumb("/doctors", "Doctors", doc?.name ?? "Doctor Profile");
  const { items: appointments } = useList<AppointmentDTO>("/appointments", { all: true });
  const { items: queue } = useList<OpdRecordDTO>("/opd", { all: true });
  const { can } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<typeof TABS[number]>("Schedule");

  if (loading) {
    return <div className={`${tw.gutterX} py-20 text-center text-[color:var(--ink-soft)]`}>Loading…</div>;
  }
  if (!doc) {
    return (
      <div className={`${tw.gutterX} py-20 text-center text-[color:var(--ink-soft)]`}>
        Doctor not found.{" "}
        <Link href="/doctors" className="text-[color:var(--brand)] underline">Back to Doctors</Link>
      </div>
    );
  }

  const initials = doc.name.replace("Dr. ", "").split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href="/doctors" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Doctor Profile</div>
          <div className="text-[17px] font-medium text-[color:var(--ink)] leading-tight">{doc.name}</div>
        </div>
        {can("doctors", "write") && (
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 text-[13px] font-normal text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">
            <Pencil size={14} strokeWidth={1.5} /> Edit details
          </button>
        )}
        <StatusBadge status={doc.status} />
      </div>
      <DoctorFormModal open={editOpen} doctor={doc} onClose={() => setEditOpen(false)} onSaved={reload} />

      <div className={`${tw.gutterX} py-6 flex gap-6 items-start`}>
        {/* Left profile card */}
        <div className={`${tw.surface.card} ${tw.radius.card} p-6 flex flex-col items-center gap-4 shrink-0`} style={{ width: 260 }}>
          <div className="w-20 h-20 rounded-full bg-[color:var(--brand)] flex items-center justify-center">
            <span className="text-white text-[28px] font-medium">{initials}</span>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-medium text-[color:var(--ink)]">{doc.name}</div>
            <div className="text-[13px] font-normal text-[color:var(--ink-soft)] mt-1">{doc.specialty}</div>
            <div className="text-[12px] font-light text-[color:var(--ink-soft)]">{doc.department}</div>
          </div>
          <div className="w-full h-px bg-[color:var(--subtle-2)]" />
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] text-[color:var(--ink-soft)]">
              <Phone size={14} strokeWidth={1.5} className="shrink-0" />
              {doc.phone}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[color:var(--ink-soft)]">
              <Award size={14} strokeWidth={1.5} className="shrink-0" />
              {doc.experience} experience
            </div>
          </div>
          <div className="w-full h-px bg-[color:var(--subtle-2)]" />
          <div className="w-full">
            <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">Today's Patients</div>
            <div className="text-[28px] font-medium text-[color:var(--brand)]">{doc.patientsToday}</div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {/* Stat row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard icon={Users} value={String(doc.patientsToday)} label="Patients Today" color="#009598" />
            <StatCard icon={Star} value="4.8" label="Patient Rating" color="#ff9000" />
            <StatCard icon={TrendingUp} value={doc.experience} label="Experience" color="#007cff" />
          </div>

          {/* Tab panel */}
          <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
            {/* Tab header */}
            <div className="flex" style={{ borderBottom: "1px solid var(--line)" }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-4 text-[14px] font-normal transition-colors relative whitespace-nowrap ${
                    tab === t ? "text-[color:var(--brand)]" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  {t}
                  {tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[color:var(--brand)]" />}
                </button>
              ))}
            </div>

            {tab === "Schedule"         && <ScheduleTab doctorId={doc.id} />}
            {tab === "Today's Patients" && <TodayPatientsTab doctorName={doc.name} queue={queue} />}
            {tab === "Performance"      && <PerformanceTab doc={doc} appointments={appointments} />}
          </div>
        </div>
      </div>
    </>
  );
}
