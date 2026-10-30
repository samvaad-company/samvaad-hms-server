"use client";

/** Housekeeping: the cleaning board, room readiness and the linen ledger. */
import { useState } from "react";
import { Plus, SprayCan } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useItem } from "@/lib/api/hooks";
import type { HkBoardDTO } from "@/types/api";
import { TasksBoard } from "@/components/housekeeping/TasksBoard";
import { RoomReadiness } from "@/components/housekeeping/RoomReadiness";
import { LinenLedger } from "@/components/housekeeping/LinenLedger";

const TABS = [{ id: "tasks", label: "Tasks" }, { id: "rooms", label: "Room readiness" }, { id: "linen", label: "Linen" }] as const;

export default function HousekeepingPage() {
  const { can, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("tasks");
  const [newTask, setNewTask] = useState(false);
  const { item: board, error } = useItem<HkBoardDTO>(authLoading || !can("beds", "read") ? null : "/housekeeping");
  if (authLoading) return null;
  if (!can("beds", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Housekeeping is available to staff with access to beds and wards.</p></div>;
  const c = board?.counts;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[color:var(--line)] px-5 py-3">
          <SprayCan size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Housekeeping</h1>
          {c && (
            <p className="flex gap-4 font-mono text-[13px]">
              <span className="text-[#c8001a]">Pending {c.pending}</span><span className="text-[#b45309]">Cleaning {c.cleaning}</span>
              <span className="text-[color:var(--ink)]">To verify {c.toVerify}</span><span className="text-[#0b7a47]">Ready {c.ready}/{c.beds}</span>
            </p>
          )}
          {can("beds", "write") && <button onClick={() => setNewTask(true)} className="ml-auto inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-4 py-[7px] text-[13px] font-medium text-white"><Plus size={14} />New task</button>}
        </div>
        <div className="px-5 pt-3">
          <div role="tablist" className="inline-flex rounded-[10px] bg-[color:var(--subtle-2)] p-[3px]">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`cursor-pointer rounded-[8px] px-3 py-[5px] text-[14px] ${tab === t.id ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{t.label}</button>)}
          </div>
        </div>
        {error && <p role="alert" className="m-5 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">Housekeeping couldn&apos;t be loaded.</p>}
        {!board && !error && <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>}
        {board && tab === "tasks" && <TasksBoard board={board} openNew={newTask} onClose={() => setNewTask(false)} />}
        {board && tab === "rooms" && <RoomReadiness board={board} />}
        {tab === "linen" && <LinenLedger />}
      </div>
    </div>
  );
}
