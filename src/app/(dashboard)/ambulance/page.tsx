"use client";

/** Ambulance: dispatch (the fleet board and the calls being worked), the call log, the fleet and a dashboard. */
import { useState } from "react";
import { Ambulance as AmbulanceIcon } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useList } from "@/lib/api/hooks";
import type { AmbulanceCallDTO, AmbulanceDTO, PatientDTO } from "@/types/api";
import { DispatchTab } from "@/components/ambulance/DispatchTab";
import { CallsTab } from "@/components/ambulance/CallsTab";
import { FleetTab } from "@/components/ambulance/FleetTab";
import { AmbulanceDashboard } from "@/components/ambulance/AmbulanceDashboard";

const TABS = [{ id: "dispatch", label: "Dispatch" }, { id: "calls", label: "Calls" }, { id: "fleet", label: "Fleet" }, { id: "dashboard", label: "Dashboard" }] as const;

export default function AmbulancePage() {
  const { can, loading } = useAuth();
  const allowed = !loading && can("ambulance", "read");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("dispatch");
  const calls = useList<AmbulanceCallDTO>(allowed ? "/ambulance/calls" : null, { all: true });
  const vehicles = useList<AmbulanceDTO>(allowed ? "/ambulance/vehicles" : null, { all: true });
  const patients = useList<PatientDTO>(allowed && tab === "dispatch" ? "/patients" : null, { all: true });
  if (loading) return null;
  if (!allowed) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Ambulance is available to staff with access to dispatch.</p></div>;
  const canWrite = can("ambulance", "write");
  const reload = () => { calls.reload(); vehicles.reload(); };
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3"><AmbulanceIcon size={16} className="text-[color:var(--ink-soft)]" /><h1 className="text-[15px] font-semibold">Ambulance</h1></div>
        <div className="px-5 pt-3">
          <div role="tablist" className="inline-flex rounded-[10px] bg-[color:var(--subtle-2)] p-[3px]">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`cursor-pointer rounded-[8px] px-3 py-[5px] text-[14px] ${tab === t.id ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{t.label}</button>)}
          </div>
        </div>
        {tab === "dispatch" && <DispatchTab vehicles={vehicles.items} calls={calls.items} patients={patients.items} canWrite={canWrite} reload={reload} />}
        {tab === "calls" && <CallsTab calls={calls.items} canWrite={canWrite} reload={reload} />}
        {tab === "fleet" && <FleetTab vehicles={vehicles.items} canWrite={canWrite} reload={reload} />}
        {tab === "dashboard" && <AmbulanceDashboard />}
      </div>
    </div>
  );
}
