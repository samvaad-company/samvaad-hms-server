"use client";

/** Checklists: start one for a patient from a template, tick it off line by line, complete it. */
import { useState } from "react";
import { ListChecks, Plus, Search } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useHydrated } from "@/lib/use-hydrated";
import type { IpdChecklistDTO } from "@/types/api";
import { ChecklistDrawer, STATUS_PILL } from "@/components/ipd/checklists/ChecklistDrawer";
import { StartChecklistDialog } from "@/components/ipd/checklists/StartChecklistDialog";
import { TemplatesPanel } from "@/components/ipd/checklists/TemplatesPanel";
import { Empty, useAutoRefresh } from "@/components/ipd/nurse/shared";

const TABS = ["In progress", "Complete", "Cancelled", "Templates"] as const;
type Tab = (typeof TABS)[number];

export default function ChecklistsPage() {
  const { can } = useAuth();
  const hydrated = useHydrated();
  const canWrite = can("nursing", "write");
  const { items, reload } = useList<IpdChecklistDTO>("/ipd/checklists", { all: true });
  useAutoRefresh(reload, 60_000);
  const [tab, setTab] = useState<Tab>("In progress");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const needle = q.trim().toLowerCase();
  const inTab = (s: Tab) => items.filter((c) => c.status === s);
  const shown = tab === "Templates" ? [] : inTab(tab).filter((c) => !needle || [c.name, c.patientName, c.patientCode].some((v) => v.toLowerCase().includes(needle)));

  return (
    <>
      <div className={`${tw.gutterX} pt-[16px] pb-3 flex items-center gap-3 flex-wrap`}>
        <ListChecks size={18} className="text-[color:var(--ink-soft)]" />
        <h1 className="text-[17px] font-semibold text-[color:var(--ink)]">Checklists</h1>
        <div role="tablist" aria-label="Checklist status" className="inline-flex p-[3px] rounded-[8px] bg-[color:var(--subtle)]">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`h-[28px] px-3 rounded-[6px] text-[13px] cursor-pointer ${tab === t ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
              {t}{t !== "Templates" && <span className="ml-1 font-mono text-[11px]">{inTab(t).length}</span>}
            </button>
          ))}
        </div>
        {tab !== "Templates" && (
          <div className="relative w-[280px] max-w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Patient, UHID or checklist" aria-label="Search checklists"
              className="h-[34px] w-full rounded-[8px] bg-[color:var(--surface)] border border-[color:var(--line)] pl-[32px] pr-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]" />
          </div>
        )}
        {hydrated && canWrite && (
          <button onClick={() => setStarting(true)} className="ml-auto inline-flex items-center gap-2 h-[34px] px-4 rounded-[8px] bg-[color:var(--brand)] text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer transition-colors">
            <Plus size={14} /> Start checklist
          </button>
        )}
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        {tab === "Templates" ? (
          <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}><TemplatesPanel canWrite={canWrite} /></div>
        ) : shown.length === 0 ? (
          <div className={`${tw.surface.card} ${tw.radius.card}`}>
            <Empty>{items.length === 0 ? "No checklists yet — start one for a patient." : `No ${tab.toLowerCase()} checklists${needle ? " match your search" : ""}.`}</Empty>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-4 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-3 text-left hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[color:var(--ink)] leading-[20px]">{c.name}</p>
                    <p className="text-[12px] text-[color:var(--ink-soft)]">{c.patientName} · <span className="font-mono">{c.patientCode}</span></p>
                  </div>
                  <div className="h-[6px] w-[124px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden"><div className="h-full bg-[color:var(--brand)]" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></div>
                  <span className="w-[44px] text-right font-mono text-[12px] text-[color:var(--ink)]">{c.done}/{c.total}</span>
                  <span className={`rounded-full px-3 py-[2px] text-[12px] font-medium ${STATUS_PILL[c.status]}`}>{c.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StartChecklistDialog open={starting} onClose={() => setStarting(false)} onStarted={(c) => { reload(); setOpenId(c.id); }} />
      {openId != null && <ChecklistDrawer id={openId} canWrite={canWrite} onClose={() => { setOpenId(null); reload(); }} />}
    </>
  );
}
