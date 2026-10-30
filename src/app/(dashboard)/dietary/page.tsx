"use client";

/** Dietary & kitchen: the ward board and kitchen sheet, diet orders, the production plan, the canteen and the diets served. */
import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useItem } from "@/lib/api/hooks";
import type { DietBoardDTO } from "@/types/api";
import { todayLocal } from "@/components/mrd/shared";
import { BoardTab } from "@/components/dietary/BoardTab";
import { OrdersTab } from "@/components/dietary/OrdersTab";
import { KitchenTab } from "@/components/dietary/KitchenTab";
import { CanteenTab } from "@/components/dietary/CanteenTab";
import { DietsTab } from "@/components/dietary/DietsTab";

const TABS = [{ id: "board", label: "Board" }, { id: "orders", label: "Orders" }, { id: "kitchen", label: "Kitchen" }, { id: "canteen", label: "Canteen" }, { id: "diets", label: "Diets" }] as const;

export default function DietaryPage() {
  const { can, loading } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("board");
  const [wardId, setWardId] = useState<number | null>(null);
  const date = todayLocal();
  // The ward list comes with the board; the first ward is chosen until someone picks another.
  const { item: board } = useItem<DietBoardDTO>(loading || !can("ipd", "read") ? null : `/dietary/board?date=${date}${wardId ? `&wardId=${wardId}` : ""}`);
  if (loading) return null;
  if (!can("ipd", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Dietary & kitchen is available to staff with access to inpatients.</p></div>;
  const selected = wardId ?? board?.wardId ?? null;
  const canWrite = can("ipd", "write");
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <UtensilsCrossed size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Dietary &amp; kitchen</h1>
          <span className="font-mono text-[13px] text-[color:var(--ink-soft)]">{date}</span>
          {(tab === "board" || tab === "orders") && board && board.wards.length > 0 && (
            <select aria-label="Ward" value={selected ?? ""} onChange={(e) => setWardId(Number(e.target.value))} className="ml-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[7px] text-[14px]">
              {board.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
        </div>
        <div className="px-5 pt-3">
          <div role="tablist" className="inline-flex rounded-[10px] bg-[color:var(--subtle-2)] p-[3px]">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`cursor-pointer rounded-[8px] px-3 py-[5px] text-[14px] ${tab === t.id ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{t.label}</button>)}
          </div>
        </div>
        {tab === "board" && <BoardTab date={date} wardId={selected} />}
        {tab === "orders" && <OrdersTab wardId={selected} canWrite={canWrite} />}
        {tab === "kitchen" && <KitchenTab date={date} />}
        {tab === "canteen" && <CanteenTab date={date} canWrite={canWrite} />}
        {tab === "diets" && <DietsTab canWrite={canWrite} />}
      </div>
    </div>
  );
}
