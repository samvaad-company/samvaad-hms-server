"use client";

/**
 * Lab Technician home panel — pathology worklists (sample collection, report
 * entry) with a radiology tab.
 */
import { useState } from "react";
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { LabTestDTO, RadiologyTestDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TabBar } from "@/components/shared/TabBar";
import { FlaskConical, ScanLine, Droplets, FileCheck } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, WorklistCard, EmptyRow, MyTasksCard } from "./shared";

export function LabPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState("lab");
  const { items: labTests } = useList<LabTestDTO>("/lab", { all: true });
  const { items: scans } = useList<RadiologyTestDTO>("/radiology", { all: true });

  const samplesPending = labTests.filter(t => t.sampleStatus === "Pending" && t.status !== "Cancelled");
  const reportsPending = labTests.filter(t => t.sampleStatus === "Collected" && t.reportStatus === "Pending" && t.status !== "Cancelled");
  const scansPending = scans.filter(s => s.status === "Pending" || s.status === "Scan Done");

  const rows = tab === "lab"
    ? [...samplesPending, ...reportsPending]
    : scansPending;

  return (
    <>
      <PanelHeader name={user?.name ?? "Technician"} subtitle="Diagnostics · Lab Panel" badge="Lab Open" />

      <StatRow stats={[
        { icon: Droplets,     label: "Samples to Collect", value: String(samplesPending.length), color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: FileCheck,    label: "Reports to Enter",   value: String(reportsPending.length), color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: ScanLine,     label: "Imaging Pending",    value: String(scansPending.length),   color: "text-[#009598]", bg: "bg-[#e8f7f7]" },
        { icon: FlaskConical, label: "Total Orders",       value: String(labTests.length),       color: "text-[#11111c]", bg: "bg-[#f0f0f0]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden flex-1 min-w-0`}>
            <TabBar
              tabs={[
                { id: "lab",       label: "Pathology Worklist", count: samplesPending.length + reportsPending.length },
                { id: "radiology", label: "Radiology Worklist", count: scansPending.length },
              ]}
              activeTab={tab} onTabChange={setTab}
            />
            <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
              {rows.length === 0 ? (
                <EmptyRow text="Worklist is clear." />
              ) : rows.map(r => (
                <div key={`${tab}-${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0] hover:bg-[#fafafa]">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#11111c] truncate">{r.testName}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{r.patientName} · {r.patientAge} yrs · {r.date}</span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 shrink-0" style={{ width: 380 }}>
            <QuickLinks links={[
              { href: "/lab",       label: "Laboratory",  description: "Orders, samples, reports", icon: FlaskConical },
              { href: "/radiology", label: "Radiology",   description: "Imaging worklist",         icon: ScanLine },
              { href: "/patients",  label: "Patients",    description: "Look up patient records",  icon: FileCheck },
            ]} />
          </div>
        </div>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        <MyTasksCard />
      </div>
    </>
  );
}
