"use client";

/**
 * Receptionist home panel — front-desk view: today's appointments, the live
 * OPD queue, and registration/booking quick actions.
 */
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { AppointmentDTO, OpdRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Calendar, Clock, Users, UserPlus, MonitorPlay, Activity } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, WorklistCard, EmptyRow, MyTasksCard } from "./shared";

export function ReceptionistPanel() {
  const { user } = useAuth();
  const { items: appointments } = useList<AppointmentDTO>("/appointments", { all: true });
  const { items: queue } = useList<OpdRecordDTO>("/opd", { all: true });

  const today = appointments.filter(a => a.status === "Today");
  const upcoming = appointments.filter(a => a.status === "Upcoming");
  const waiting = queue.filter(r => r.status === "Waiting");

  return (
    <>
      <PanelHeader name={user?.name ?? "Receptionist"} subtitle="Front Desk · Reception Panel" badge="Front Desk" />

      <StatRow stats={[
        { icon: Calendar, label: "Appointments Today", value: String(today.length),    color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: Clock,    label: "Waiting in Queue",   value: String(waiting.length),  color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: Calendar, label: "Upcoming",           value: String(upcoming.length), color: "text-[#009598]", bg: "bg-[#e8f7f7]" },
        { icon: Users,    label: "Total Bookings",     value: String(appointments.length), color: "text-[#11111c]", bg: "bg-[#f0f0f0]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          <WorklistCard title="Today's Appointments" action={{ label: "All appointments", href: "/appointments" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
              {today.length === 0 ? (
                <EmptyRow text="No appointments today." />
              ) : today.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0] hover:bg-[#fafafa]">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#11111c] truncate">{a.patientName}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{a.time} · {a.doctor} · {a.reason}</span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </WorklistCard>

          <div className="flex flex-col gap-4 shrink-0" style={{ width: 380 }}>
            <WorklistCard title="Live OPD Queue" action={{ label: "Queue", href: "/opd" }}>
              <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                {waiting.length === 0 ? (
                  <EmptyRow text="Queue is clear." />
                ) : waiting.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[14px] font-medium text-[#009598]">{r.tokenNumber}</span>
                      <span className="text-[13px] font-normal text-[#11111c] truncate">{r.patientName}</span>
                    </div>
                    <span className="text-[12px] font-light text-[#57575f] whitespace-nowrap">{r.doctor}</span>
                  </div>
                ))}
              </div>
            </WorklistCard>

            <QuickLinks links={[
              { href: "/patients/new",  label: "Register Patient",  description: "New patient registration", icon: UserPlus },
              { href: "/appointments",  label: "Book Appointment",  description: "Schedule a visit",          icon: Calendar },
              { href: "/opd",           label: "OPD Desk",          description: "Manage today's queue",      icon: Activity },
              { href: "/queue-board",   label: "Token Board",       description: "Waiting-room display",      icon: MonitorPlay },
            ]} />
          </div>
        </div>
      </div>
      <MyTasksCard />
    </>
  );
}
