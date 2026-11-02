"use client";

/** Reports → AI monitor: use of the scribe, the AI chat and the WhatsApp bot. */
import { Cpu } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { AiMonitorView } from "@/components/reports/AiMonitorView";

export default function AiMonitorPage() {
  const { can, loading } = useAuth();
  if (loading) return null;
  if (!can("reports", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">The AI monitor is available to people with access to reports.</p></div>;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3"><Cpu size={16} className="text-[color:var(--ink-soft)]" /><h1 className="text-[15px] font-semibold">AI monitor</h1></div>
        <AiMonitorView />
      </div>
    </div>
  );
}
