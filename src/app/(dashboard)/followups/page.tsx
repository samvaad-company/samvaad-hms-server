"use client";

/** Follow-ups: the list of patients due back, and analytics on how many follow-ups are kept, missed or still due. */
import { useState } from "react";
import { BarChart3, ClipboardCheck, ListChecks } from "lucide-react";
import { FollowUpList } from "@/components/followups/FollowUpList";
import { FollowUpAnalytics } from "@/components/followups/FollowUpAnalytics";

const TABS = [
  { id: "list", label: "Follow-ups", icon: ListChecks },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

export default function FollowUpsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("list");
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 pt-3 border-b border-[color:var(--line)]">
        <ClipboardCheck size={15} strokeWidth={1.5} className="text-[color:var(--ink-soft)] mb-[10px]" />
        <h1 className="text-[14px] font-semibold text-[color:var(--ink)] mb-[10px]">Follow-ups</h1>
        <nav className="flex flex-wrap items-center gap-1 ml-3 max-lg:ml-0 max-lg:w-full max-lg:gap-2 max-lg:pb-3" aria-label="Follow-up views">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
              className={`inline-flex items-center gap-[6px] px-3 py-[9px] text-[13px] border-b-2 cursor-pointer transition-colors max-lg:rounded-full max-lg:border max-lg:py-[7px] ${tab === t.id ? "border-[color:var(--brand)] text-[color:var(--brand)] font-medium max-lg:bg-[color:var(--brand-soft)]" : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] max-lg:border-[color:var(--line)]"}`}>
              <t.icon size={14} strokeWidth={1.5} /> {t.label}
            </button>
          ))}
        </nav>
      </div>
      {tab === "list" ? <FollowUpList /> : <FollowUpAnalytics />}
    </>
  );
}
