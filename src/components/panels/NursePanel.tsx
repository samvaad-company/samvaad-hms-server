"use client";

/**
 * Head Nurse home panel — ward view: admitted patients, bed occupancy, and
 * inpatient quick actions.
 */
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { IpdRecordDTO, BedDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BedDouble, Users, LayoutGrid, Activity, HeartPulse } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, WorklistCard, EmptyRow } from "./shared";

export function NursePanel() {
  const { user } = useAuth();
  const { items: admissions } = useList<IpdRecordDTO>("/ipd", { all: true });
  const { items: beds } = useList<BedDTO>("/beds", { all: true });

  const active = admissions.filter(a => a.status !== "Discharged");
  const icu = admissions.filter(a => a.status === "ICU");
  const available = beds.filter(b => b.status === "Available").length;
  const occupied = beds.filter(b => b.status === "Occupied").length;

  return (
    <>
      <PanelHeader name={user?.name ?? "Nurse"} subtitle="Ward Management · Nursing Panel" badge="Ward Live" />

      <StatRow stats={[
        { icon: Users,      label: "Admitted Patients", value: String(active.length), color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: HeartPulse, label: "In ICU",            value: String(icu.length),    color: "text-[#ff0004]", bg: "bg-[#ffe9e9]" },
        { icon: BedDouble,  label: "Beds Occupied",     value: String(occupied),      color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: LayoutGrid, label: "Beds Available",    value: String(available),     color: "text-[#00955c]", bg: "bg-[#dffff3]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          <WorklistCard title="Admitted Patients" action={{ label: "All IPD", href: "/ipd" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
              {active.length === 0 ? (
                <EmptyRow text="No admitted patients." />
              ) : active.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0] hover:bg-[#fafafa]">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#11111c] truncate">{a.patientName}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{a.ward} · Bed {a.bed} · {a.diagnosis}</span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </WorklistCard>

          <div className="flex flex-col gap-4 shrink-0" style={{ width: 380 }}>
            <QuickLinks links={[
              { href: "/ipd",          label: "IPD Admissions", description: "Admit, transfer, discharge", icon: BedDouble },
              { href: "/beds",         label: "Beds & Wards",   description: "Occupancy overview",         icon: LayoutGrid },
              { href: "/opd",          label: "OPD Queue",      description: "Record patient vitals",      icon: Activity },
              { href: "/patients",     label: "Patients",       description: "Search patient records",     icon: Users },
            ]} />
          </div>
        </div>
      </div>
    </>
  );
}
