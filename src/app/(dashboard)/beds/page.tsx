"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { LayoutGrid, Plus, ArrowRight } from "lucide-react";
import { beds } from "@/data/beds";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import type { Bed, BedStatus } from "@/types";

// ─── Bed Status ───────────────────────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  Available:   "bg-[#dffff3] border-[#b8f0d9]",
  Occupied:    "bg-[#ffe9e9] border-[#ffc8c8]",
  Reserved:    "bg-[#fff2e0] border-[#ffd99a]",
  Maintenance: "bg-[#f0f0f0] border-[#dedee1]",
  Cleaning:    "bg-[#d6eaff] border-[#b0d4ff]",
  Blocked:     "bg-[#f0f0f0] border-[#c8c8cc]",
};

const STATUS_DOT: Record<string, string> = {
  Available:   "bg-[#00955c]",
  Occupied:    "bg-[#ff0004]",
  Reserved:    "bg-[#ff9000]",
  Maintenance: "bg-[#57575f]",
  Cleaning:    "bg-[#007cff]",
  Blocked:     "bg-[#11111c]",
};

const ALL_WARDS = ["All", "General Ward", "ICU", "Cardiology Ward", "Surgery Ward", "Maternity Ward"];

function BedCard({ bed }: { bed: Bed }) {
  const bg = STATUS_BG[bed.status] ?? "bg-[#f0f0f0] border-[#dedee1]";
  const dot = STATUS_DOT[bed.status] ?? "bg-[#57575f]";
  return (
    <div className={`flex flex-col gap-[6px] p-[12px] rounded-[10px] border ${bg}`}
         style={{ width: 140, height: 90, flexShrink: 0 }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#11111c]">{bed.bedNumber}</span>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
      </div>
      {bed.patientName ? (
        <>
          <span className="text-[11px] font-medium text-[#11111c] leading-[14px] whitespace-nowrap overflow-hidden text-ellipsis">{bed.patientName}</span>
          <span className="text-[10px] font-light text-[#57575f]">{bed.patientId}</span>
        </>
      ) : (
        <span className={`text-[11px] font-normal leading-[14px] ${STATUS_DOT[bed.status]?.includes("00955c") ? "text-[#00955c]" : STATUS_DOT[bed.status]?.includes("ff9000") ? "text-[#ff9000]" : STATUS_DOT[bed.status]?.includes("007cff") ? "text-[#007cff]" : "text-[#57575f]"}`}>
          {bed.status}
        </span>
      )}
    </div>
  );
}

function BedStatusView() {
  const [activeWard, setActiveWard] = useState("All");

  const wards = Array.from(new Set(beds.map(b => b.ward)));
  const totalOccupied  = beds.filter(b => b.status === "Occupied").length;
  const totalAvailable = beds.filter(b => b.status === "Available").length;
  const filteredBeds   = activeWard === "All" ? beds : beds.filter(b => b.ward === activeWard);
  const wardGroups: Record<string, Bed[]> =
    activeWard === "All"
      ? wards.reduce((acc, w) => ({ ...acc, [w]: beds.filter(b => b.ward === w) }), {})
      : { [activeWard]: filteredBeds };

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Ward filter */}
      <div className="bg-[#f6f6f6] inline-flex items-center gap-[10px] p-[3px] rounded-full">
        {ALL_WARDS.map(w => (
          <button key={w} onClick={() => setActiveWard(w)}
            className={`px-4 py-[5px] rounded-full text-[13px] leading-[18px] font-normal transition-colors cursor-pointer whitespace-nowrap ${activeWard === w ? "bg-[#009598] text-white" : "text-[#57575f] hover:text-[#11111c]"}`}>
            {w}
          </button>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-5">
        {(["Available","Occupied","Reserved","Maintenance","Cleaning","Blocked"] as string[]).map(s => (
          <div key={s} className="flex items-center gap-[6px]">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span className="text-[12px] font-normal text-[#57575f]">{s}</span>
          </div>
        ))}
      </div>
      {/* Ward grids */}
      <div className="flex flex-col gap-6">
        {Object.entries(wardGroups).map(([ward, wardBeds]) => (
          <div key={ward} className="border border-[#dedee1] rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-medium text-[#11111c] leading-5">{ward}</h2>
              <span className="text-[12px] font-light text-[#57575f]">
                {wardBeds.length} beds · {wardBeds.filter(b => b.status === "Occupied").length} occupied · {wardBeds.filter(b => b.status === "Available").length} available
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {wardBeds.map(b => <BedCard key={b.id} bed={b} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Transfers ────────────────────────────────────────────────────────────────

const TRANSFERS = [
  { id: 1, patient: "Noah Carter",   from: "ICU · B-01",           to: "Cardiology · C-04",     date: "12 Nov 2025", reason: "Stable condition", status: "Completed" },
  { id: 2, patient: "Sophia Adams",  from: "General Ward · A-05",  to: "Surgery Ward · D-02",   date: "11 Nov 2025", reason: "Pre-op preparation", status: "Completed" },
  { id: 3, patient: "Liam Johnson",  from: "Surgery Ward · D-03",  to: "General Ward · A-08",   date: "10 Nov 2025", reason: "Post-op recovery", status: "Completed" },
  { id: 4, patient: "Emma Williams", from: "Maternity · E-01",     to: "ICU · B-03",            date: "9 Nov 2025",  reason: "Emergency escalation", status: "Completed" },
  { id: 5, patient: "James Brown",   from: "General Ward · A-03",  to: "Cardiology · C-07",     date: "8 Nov 2025",  reason: "Cardiac monitoring", status: "Completed" },
  { id: 6, patient: "Olivia Davis",  from: "General Ward · A-11",  to: "Surgery Ward · D-01",   date: "7 Nov 2025",  reason: "Surgery scheduled", status: "Pending" },
];

const TRANSFER_CLR: Record<string, string> = {
  Completed: "bg-[#dffff3] text-[#00955c]",
  Pending:   "bg-[#fff2e0] text-[#ff9000]",
};

function TransfersView() {
  return (
    <div className="overflow-x-auto" style={{ height: 555 }}>
      <div style={{ minWidth: 1100 }}>
        <div className="relative h-10 bg-[#f2f3f3]" style={{ minWidth: 1100 }}>
          {[{ l: "Patient", x: 20 }, { l: "From", x: 220 }, { l: "To", x: 460 }, { l: "Date", x: 700 }, { l: "Reason", x: 860 }, { l: "Status", x: 1040 }].map(c => (
            <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
          ))}
        </div>
        {TRANSFERS.map(t => (
          <div key={t.id} className="relative flex items-center h-[64px] border-b border-[#dedee1] last:border-0 bg-white hover:bg-[#fafafa] transition-colors" style={{ minWidth: 1100 }}>
            <span className="absolute text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: 20 }}>{t.patient}</span>
            <div className="absolute flex items-center gap-2" style={{ left: 220 }}>
              <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{t.from}</span>
              <ArrowRight size={14} className="text-[#57575f] shrink-0" />
              <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{t.to}</span>
            </div>
            <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 700 }}>{t.date}</span>
            <span className="absolute text-[13px] font-normal text-[#57575f] whitespace-nowrap" style={{ left: 860 }}>{t.reason}</span>
            <span className={`absolute inline-flex items-center px-[10px] py-[4px] rounded-full text-[12px] font-normal whitespace-nowrap ${TRANSFER_CLR[t.status]}`} style={{ left: 1040 }}>{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "status",    label: "Bed Status",  count: beds.length },
  { id: "transfers", label: "Transfers",   count: TRANSFERS.length },
];

export default function BedsPage() {
  const [tab, setTab] = useState("status");

  const totalOccupied  = beds.filter(b => b.status === "Occupied").length;
  const totalAvailable = beds.filter(b => b.status === "Available").length;

  return (
    <>
      <PageHeader
        title="Beds & Wards"
        subtitle="Monitor bed availability, patient assignments, and maintenance status across all wards."
        stats={[
          { icon: LayoutGrid, value: String(totalOccupied),  label: "Occupied" },
          { icon: LayoutGrid, value: String(totalAvailable), label: "Available" },
        ]}
        action={{ label: "Add Bed", icon: Plus }}
        dateRange={false}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "status"    && <BedStatusView />}
          {tab === "transfers" && <TransfersView />}
        </div>
      </div>
    </>
  );
}
