"use client";

/**
 * Tele Caller home panel — today's video consultations, links still to be
 * sorted out, and a way in to book one for a patient.
 */
import Link from "next/link";
import { CalendarClock, IndianRupee, Link2Off, Video } from "lucide-react";
import { useItem, useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { AppointmentDTO, TeleconsultConfigDTO } from "@/types/api";
import { tw } from "@/lib/design-system";
import { ConsultLinkActions } from "@/components/teleconsult/ConsultLinkActions";
import { PanelHeader, StatRow, WorklistCard, EmptyRow } from "./shared";

export function TeleCallerPanel() {
  const { user } = useAuth();
  const { item: config } = useItem<TeleconsultConfigDTO>("/teleconsult/config");
  const { items, reload } = useList<AppointmentDTO>("/appointments", { all: true, type: "Tele-consult" });

  const open = items.filter(a => a.status === "Today" || a.status === "Upcoming").sort((a, b) => a.date.localeCompare(b.date));
  const pending = open.filter(a => !a.videoUrl);
  const collected = items.filter(a => a.status !== "Cancelled").reduce((n, a) => n + (a.consultAmount ?? 0), 0);

  return (
    <>
      <PanelHeader name={user?.name ?? "Tele Caller"} subtitle="Video Consultations · Tele Caller Panel" badge={config?.enabled ? "Accepting bookings" : "Switched off"} />
      <StatRow stats={[
        { icon: CalendarClock, label: "Upcoming",     value: String(open.length),    color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: Link2Off,      label: "Link Pending", value: String(pending.length), color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: Video,         label: "All Consults", value: String(items.length),   color: "text-[#009598]", bg: "bg-[#e8f7f7]" },
        { icon: IndianRupee,   label: "Fees",         value: `₹${collected.toLocaleString("en-IN")}`, color: "text-[#00955c]", bg: "bg-[#dffff3]" },
      ]} />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <WorklistCard title="Upcoming video consultations" action={{ label: "Open Video Consults", href: "/teleconsult" }}>
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {open.length === 0 ? (
              <EmptyRow text="No upcoming video consultations." />
            ) : open.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 border-t border-[#f0f0f0] hover:bg-[#fafafa] transition-colors">
                <div className="flex flex-col min-w-0">
                  <Link href={`/appointments/${a.id}`} className="text-[13px] font-medium text-[#11111c] truncate hover:underline">{a.patientName}</Link>
                  <span className="text-[11px] font-light text-[#57575f] truncate">{a.doctor} · {a.date} · {a.time}</span>
                </div>
                <ConsultLinkActions appt={a} canWrite onChanged={reload} />
              </div>
            ))}
          </div>
        </WorklistCard>
      </div>
    </>
  );
}
