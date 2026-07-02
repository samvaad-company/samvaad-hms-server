"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { ArrowLeft, Phone, Mail, Calendar, Clock, Star, Users, TrendingUp, Award } from "lucide-react";
import { useItem, useList } from "@/lib/api/hooks";
import type { DoctorDTO, AppointmentDTO, OpdRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Link from "next/link";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHIFTS = ["Morning (9 AM – 1 PM)", "Evening (4 PM – 8 PM)"];

function StatCard({ icon: Icon, value, label, color }: { icon: typeof Users; value: string; label: string; color: string }) {
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex items-center gap-4`}>
      <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0`} style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-[22px] font-medium text-[#11111c] leading-none">{value}</div>
        <div className="text-[12px] font-normal text-[#57575f] mt-1">{label}</div>
      </div>
    </div>
  );
}

function ScheduleTab({ doctorId }: { doctorId: number }) {
  return (
    <div className="p-6">
      <div className="grid gap-3" style={{ gridTemplateColumns: "120px repeat(6, 1fr)" }}>
        <div />
        {DAYS.map(d => (
          <div key={d} className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider text-center py-2">{d}</div>
        ))}
        {SHIFTS.map((shift, si) => (
          <>
            <div key={shift} className="text-[12px] font-normal text-[#57575f] flex items-center py-3">{shift}</div>
            {DAYS.map((day, di) => {
              const isOff = day === "Sat" && si === 1;
              const isLeave = doctorId === 7 || doctorId === 8;
              return (
                <div key={day + si} className={`rounded-[8px] p-3 text-center text-[11px] font-medium ${
                  isLeave ? "bg-[#ffe9e9] text-[#ff0004]" : isOff ? "bg-[#f2f3f3] text-[#57575f]" : "bg-[#e8f7f7] text-[#009598]"
                }`}>
                  {isLeave ? "On Leave" : isOff ? "Off" : si === 0 ? "9–1 PM" : "4–8 PM"}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

function TodayPatientsTab({ doctorName, queue }: { doctorName: string; queue: OpdRecordDTO[] }) {
  const todays = queue.filter(r => r.doctor === doctorName);
  if (todays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#57575f]">
        <Users size={40} strokeWidth={1} className="mb-3 opacity-30" />
        <span className="text-[14px]">No patients scheduled today</span>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[#f0f0f0]">
      {todays.map(r => (
        <div key={r.id} className="flex items-center gap-4 px-6 py-4">
          <span className="text-[16px] font-medium text-[#009598] w-14">{r.tokenNumber}</span>
          <div className="flex-1">
            <div className="text-[14px] font-medium text-[#11111c]">{r.patientName}</div>
            <div className="text-[12px] font-light text-[#57575f]">{r.patientAge} yrs · Check-in {r.checkInTime}</div>
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
        <div key={s.label} className="rounded-[12px] border border-[#dedee1] p-5">
          <div className="text-[28px] font-medium text-[#009598]">{s.value}</div>
          <div className="text-[13px] font-normal text-[#57575f] mt-1">{s.label}</div>
        </div>
      ))}
      <div className="col-span-2 rounded-[12px] border border-[#dedee1] p-5">
        <div className="text-[12px] font-medium text-[#57575f] uppercase tracking-wider mb-3">Completion Rate</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-[#f2f3f3] rounded-full overflow-hidden">
            <div className="h-full bg-[#009598] rounded-full transition-all" style={{ width: `${rate}%` }} />
          </div>
          <span className="text-[14px] font-medium text-[#009598]">{rate}%</span>
        </div>
      </div>
    </div>
  );
}

const TABS = ["Schedule", "Today's Patients", "Performance"] as const;

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item: doc, loading } = useItem<DoctorDTO>(`/doctors/${id}`);
  const { items: appointments } = useList<AppointmentDTO>("/appointments", { all: true });
  const { items: queue } = useList<OpdRecordDTO>("/opd", { all: true });
  const [tab, setTab] = useState<typeof TABS[number]>("Schedule");

  if (loading) {
    return <div className={`${tw.gutterX} py-20 text-center text-[#57575f]`}>Loading…</div>;
  }
  if (!doc) {
    return (
      <div className={`${tw.gutterX} py-20 text-center text-[#57575f]`}>
        Doctor not found.{" "}
        <Link href="/doctors" className="text-[#009598] underline">Back to Doctors</Link>
      </div>
    );
  }

  const initials = doc.name.replace("Dr. ", "").split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid #dedee1" }}>
        <Link href="/doctors" className="p-2 rounded-[8px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Doctor Profile</div>
          <div className="text-[17px] font-medium text-[#11111c] leading-tight">{doc.name}</div>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <div className={`${tw.gutterX} py-6 flex gap-6 items-start`}>
        {/* Left profile card */}
        <div className={`${tw.surface.card} ${tw.radius.card} p-6 flex flex-col items-center gap-4 shrink-0`} style={{ width: 260 }}>
          <div className="w-20 h-20 rounded-full bg-[#009598] flex items-center justify-center">
            <span className="text-white text-[28px] font-medium">{initials}</span>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-medium text-[#11111c]">{doc.name}</div>
            <div className="text-[13px] font-normal text-[#57575f] mt-1">{doc.specialty}</div>
            <div className="text-[12px] font-light text-[#57575f]">{doc.department}</div>
          </div>
          <div className="w-full h-px bg-[#f0f0f0]" />
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] text-[#57575f]">
              <Phone size={14} strokeWidth={1.5} className="shrink-0" />
              {doc.phone}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[#57575f]">
              <Award size={14} strokeWidth={1.5} className="shrink-0" />
              {doc.experience} experience
            </div>
          </div>
          <div className="w-full h-px bg-[#f0f0f0]" />
          <div className="w-full">
            <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Today's Patients</div>
            <div className="text-[28px] font-medium text-[#009598]">{doc.patientsToday}</div>
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
            <div className="flex" style={{ borderBottom: "1px solid #dedee1" }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-4 text-[14px] font-normal transition-colors relative whitespace-nowrap ${
                    tab === t ? "text-[#009598]" : "text-[#57575f] hover:text-[#11111c]"
                  }`}
                >
                  {t}
                  {tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#009598]" />}
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
