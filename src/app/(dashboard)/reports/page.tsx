"use client";

/** Reports → Reports: the catalogue of every report, by category; opening one runs it for a period. */
import { FileBarChart } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { ReportsCatalog } from "@/components/reports/ReportsCatalog";

export default function ReportsPage() {
  const { can, loading } = useAuth();
  if (loading) return null;
  if (!can("reports", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Reports are available to people with access to reports.</p></div>;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3"><FileBarChart size={16} className="text-[color:var(--ink-soft)]" /><h1 className="text-[15px] font-semibold">Reports</h1></div>
        <ReportsCatalog />
      </div>
    </div>
  );
}
