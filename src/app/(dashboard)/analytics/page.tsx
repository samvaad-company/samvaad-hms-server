"use client";

/** Reports → Analytics: the trend dashboard, with the report catalogue and the AI monitor a tab away. */
import { useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { AnalyticsDashboard } from "@/components/reports/AnalyticsDashboard";
import { ReportsCatalog } from "@/components/reports/ReportsCatalog";
import { AiMonitorView } from "@/components/reports/AiMonitorView";

const TABS = [{ id: "dashboard", label: "Dashboard" }, { id: "reports", label: "Reports" }, { id: "ai", label: "AI monitor" }] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AnalyticsPage() {
  const { can, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refresh, setRefresh] = useState(0);
  if (loading) return null;
  if (!can("reports", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Analytics are available to people with access to reports.</p></div>;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 px-5 pt-3">
          <BarChart3 size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Analytics</h1>
          <button onClick={() => setRefresh((n) => n + 1)} className="ml-auto inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px]"><RefreshCw size={13} />Refresh</button>
        </div>
        <div className="flex border-b border-[color:var(--line)] px-5" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`-mb-px cursor-pointer border-b-2 px-1 py-[12px] pr-5 text-[14px] ${tab === t.id ? "border-[color:var(--ink)] font-medium text-[color:var(--ink)]" : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>{t.label}</button>
          ))}
        </div>
        {tab === "dashboard" && <AnalyticsDashboard reloadKey={refresh} />}
        {tab === "reports" && <ReportsCatalog />}
        {tab === "ai" && <AiMonitorView key={refresh} />}
      </div>
    </div>
  );
}
