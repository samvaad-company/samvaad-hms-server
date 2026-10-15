"use client";

/**
 * Driver home panel — read-only ambulance view: my active dispatches and the
 * recent call log.
 */
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { AmbulanceCallDTO, AmbulanceDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Ambulance, MapPin, CheckCircle } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, WorklistCard, EmptyRow, MyTasksCard } from "./shared";

export function DriverPanel() {
  const { user } = useAuth();
  const { items: calls } = useList<AmbulanceCallDTO>("/ambulance/calls", { all: true });
  const { items: vehicles } = useList<AmbulanceDTO>("/ambulance/vehicles", { all: true });

  const active = calls.filter(c => c.status === "Dispatched");
  const completed = calls.filter(c => c.status === "Completed").length;
  const availableVehicles = vehicles.filter(v => v.status === "Available").length;

  return (
    <>
      <PanelHeader name={user?.name ?? "Driver"} subtitle="Transport · Ambulance Panel" badge="On Duty" />

      <StatRow stats={[
        { icon: MapPin,      label: "Active Dispatches", value: String(active.length),      color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: CheckCircle, label: "Completed Trips",   value: String(completed),          color: "text-[#00955c]", bg: "bg-[#dffff3]" },
        { icon: Ambulance,   label: "Vehicles Available",value: String(availableVehicles),  color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <WorklistCard title="Call Log" action={{ label: "Ambulance module", href: "/ambulance" }}>
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {calls.length === 0 ? (
              <EmptyRow text="No calls logged." />
            ) : calls.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[color:var(--subtle-2)] hover:bg-[color:var(--faint)]">
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{c.patientName}</span>
                  <span className="text-[11px] font-light text-[color:var(--ink-soft)] truncate">
                    {c.pickupLocation} → {c.dropLocation} · {c.vehicleNumber || "unassigned"} · {c.date} {c.time}
                  </span>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </WorklistCard>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        <MyTasksCard />
      </div>
    </>
  );
}
