"use client";

/**
 * CSSD — central sterile services (Stores). Instrument sets are packed, run through a sterilizer cycle, held sterile, issued
 * to patients and returned. Board · Cycles · Issues · Settings, with Request, Start cycle and Register set up top.
 * Writing needs the "cssd" permission.
 */
import { useState } from "react";
import { Biohazard } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { useList } from "@/lib/api/hooks";
import type { CssdSetDTO, CssdSterilizerDTO } from "@/types/api";
import { outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { BoardView, CssdHeader, CyclesView, IssuesView, SettingsView } from "@/components/cssd/CssdViews";
import { RegisterSetDialog, RequestDialog, StartCycleDialog } from "@/components/cssd/CssdDialogs";

const TABS = [
  { id: "board", label: "Board" },
  { id: "cycles", label: "Cycles" },
  { id: "issues", label: "Issues" },
  { id: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function CssdPage() {
  const { can } = useAuth();
  const canWrite = can("cssd", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.cssd.tab", IDS, "board");
  const { items: sets } = useList<CssdSetDTO>("/cssd/sets");
  const { items: sterilizers } = useList<CssdSterilizerDTO>("/cssd/sterilizers");
  const [dialog, setDialog] = useState<"register" | "request" | "cycle" | null>(null);

  return (
    <div className={`${tw.gutterX} mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <Biohazard size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">CSSD</h1>
          <div role="tablist" aria-label="CSSD" className="inline-flex p-[3px] rounded-[10px] bg-[color:var(--subtle)]">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`h-[30px] px-3 rounded-[8px] text-[14px] cursor-pointer transition-colors ${tab === t.id ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>{t.label}</button>
            ))}
          </div>
          {canWrite && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => setDialog("request")} className={outlineBtn + " !h-[36px]"}>Request</button>
              <button onClick={() => setDialog("cycle")} className={outlineBtn + " !h-[36px]"}>Start cycle</button>
              <button onClick={() => setDialog("register")} className={primaryBtn}>+ Register set</button>
            </div>
          )}
        </div>
        <CssdHeader />
        {tab === "board" && <BoardView canWrite={canWrite} sets={sets} />}
        {tab === "cycles" && <CyclesView canWrite={canWrite} />}
        {tab === "issues" && <IssuesView canWrite={canWrite} />}
        {tab === "settings" && <SettingsView canWrite={canWrite} />}
      </div>
      {dialog === "register" && <RegisterSetDialog onClose={() => setDialog(null)} />}
      {dialog === "request" && <RequestDialog sets={sets} onClose={() => setDialog(null)} />}
      {dialog === "cycle" && <StartCycleDialog sets={sets} sterilizers={sterilizers} onClose={() => setDialog(null)} />}
    </div>
  );
}
