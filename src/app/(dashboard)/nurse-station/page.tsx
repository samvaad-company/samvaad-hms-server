"use client";

/**
 * Nurse station: alerts, this shift's tasks and medicines, vitals round, IV bottles, handover and diet for
 * everyone admitted. Reading needs the "nursing" permission; recording a dose, a reading or a note needs write.
 */
import { useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useItem, useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { IpdBoardDTO, IpdRecordDTO } from "@/types/api";
import { useAutoRefresh, type WardPatient } from "@/components/ipd/nurse/shared";
import { BoardTab } from "@/components/ipd/nurse/BoardTab";
import { MedicinesTab } from "@/components/ipd/nurse/MedicinesTab";
import { VitalsTab } from "@/components/ipd/nurse/VitalsTab";
import { IvTab } from "@/components/ipd/nurse/IvTab";
import { HandoverTab } from "@/components/ipd/nurse/HandoverTab";
import { DietTab } from "@/components/ipd/nurse/DietTab";

const TABS = [
  { id: "board", label: "Board" },
  { id: "medicines", label: "Medicines" },
  { id: "vitals", label: "Vitals round" },
  { id: "iv", label: "IV bottles" },
  { id: "handover", label: "Handover" },
  { id: "diet", label: "Diet" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function NurseStationPage() {
  const { can } = useAuth();
  const canWrite = can("nursing", "write");
  const { items: records, reload } = useList<IpdRecordDTO>("/ipd", { all: true });
  const { item: board, reload: reloadBoard } = useItem<IpdBoardDTO>("/ipd/board");
  useAutoRefresh(() => { reload(); reloadBoard(); });

  const [tab, setTab] = useState<TabId>("board");
  const [mineOnly, setMineOnly] = useState(false);
  const [ward, setWard] = useState("");

  const live = useMemo(() => new Map((board?.live ?? []).map((l) => [l.admissionId, l])), [board]);
  const wardNames = [...new Set(records.filter((r) => r.status !== "Discharged").map((r) => r.ward).filter(Boolean))];
  const patients: WardPatient[] = records
    .filter((r) => r.status !== "Discharged")
    .filter((r) => !ward || r.ward === ward)
    .map((adm) => ({ adm, live: live.get(adm.id) }))
    .filter((p) => !mineOnly || p.live?.mine)
    .sort((a, b) => (a.adm.ward || "~").localeCompare(b.adm.ward || "~") || (a.adm.bed || "~").localeCompare(b.adm.bed || "~", undefined, { numeric: true }));
  const mineCount = [...live.values()].filter((l) => l.mine).length;

  return (
    <>
      <div className={`${tw.gutterX} pt-[16px] pb-3 flex items-center gap-3 flex-wrap`}>
        <HeartPulse size={18} className="text-[color:var(--ink-soft)]" />
        <div>
          <h1 className="text-[17px] font-semibold text-[color:var(--ink)] leading-[22px]">Nurse station</h1>
          <p className="text-[12px] text-[color:var(--ink-soft)]">Alerts, this shift&apos;s tasks and medicines, and your patients — live</p>
        </div>
        <span className="text-[12px] text-[color:var(--ink-soft)] ml-2">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label="Whose patients" className="inline-flex p-[3px] rounded-[8px] bg-[color:var(--subtle)]">
            <button onClick={() => setMineOnly(true)} aria-pressed={mineOnly}
              className={`h-[28px] px-3 rounded-[6px] text-[13px] cursor-pointer ${mineOnly ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
              My patients <span className="font-mono text-[11px]">{mineCount}</span>
            </button>
            <button onClick={() => setMineOnly(false)} aria-pressed={!mineOnly}
              className={`h-[28px] px-3 rounded-[6px] text-[13px] cursor-pointer ${!mineOnly ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
              All wards
            </button>
          </div>
          <select value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Ward"
            className="h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] cursor-pointer">
            <option value="">One ward…</option>
            {wardNames.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
          <div role="tablist" aria-label="Nurse station" className="flex items-center gap-1 px-5 pt-4">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`h-[32px] px-4 rounded-[8px] text-[13px] cursor-pointer transition-colors ${tab === t.id ? "bg-[color:var(--ink)] text-[color:var(--surface)] font-medium" : "text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === "board" && <BoardTab patients={patients} canWrite={canWrite} />}
          {tab === "medicines" && <MedicinesTab patients={patients} canWrite={canWrite} />}
          {tab === "vitals" && <VitalsTab patients={patients} canWrite={canWrite} />}
          {tab === "iv" && <IvTab patients={patients} canWrite={canWrite} />}
          {tab === "handover" && <HandoverTab patients={patients} canWrite={canWrite} />}
          {tab === "diet" && <DietTab patients={patients} canWrite={canWrite} />}
        </div>
      </div>
    </>
  );
}
