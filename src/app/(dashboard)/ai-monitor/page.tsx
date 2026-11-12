"use client";

/** Reports → AI monitor: how the hospital is doing and growing, and the use of the scribe, the AI chat and the WhatsApp bot. */
import { useState } from "react";
import { Cpu } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { TabBar } from "@/components/shared/TabBar";
import { AiMonitorView } from "@/components/reports/AiMonitorView";
import { PerformanceView } from "@/components/reports/PerformanceView";

const TABS = [
  { id: "performance", label: "Hospital performance" },
  { id: "ai", label: "KAYA AI usage" },
];

export default function AiMonitorPage() {
  const { can, loading } = useAuth();
  const [tab, setTab] = useState("performance");
  if (loading) return null;
  if (!can("reports", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">The AI monitor is available to people with access to reports.</p></div>;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3"><Cpu size={16} className="text-[color:var(--ink-soft)]" /><h1 className="text-[15px] font-semibold">AI monitor</h1></div>
        <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
        {tab === "performance" ? <PerformanceView /> : <AiMonitorView />}
      </div>
    </div>
  );
}
