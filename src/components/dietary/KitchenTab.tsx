"use client";

import { useItem } from "@/lib/api/hooks";
import type { KitchenDTO } from "@/types/api";

const TONE: Record<string, string> = { "Not generated": "text-[color:var(--ink-soft)]", Draft: "text-[#8a5300]", Dispatched: "text-[#2c43a8]", Received: "text-[#0b7a47]" };

/** What the kitchen has to cook: each diet at each meal across every ward, and where each ward's sheet is. */
export function KitchenTab({ date }: { date: string }) {
  const { item: k } = useItem<KitchenDTO>(`/dietary/kitchen?date=${date}`);
  if (!k) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <div className="p-4">
      <p className="mb-3 text-[13px] text-[color:var(--ink-soft)]"><b className="font-mono text-[color:var(--ink)]">{k.patients}</b> patients on a diet order · production plan for {date}</p>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Diet</th>{k.meals.map((m) => <th key={m} className="px-3 py-2 text-right font-medium">{m}</th>)}<th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
          <tbody>
            {k.diets.length === 0 && <tr><td colSpan={k.meals.length + 2} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No diet orders are active.</td></tr>}
            {k.diets.map((d) => <tr key={d.diet} className="border-t border-[color:var(--line)]"><td className="px-4 py-[9px] font-medium">{d.diet}</td>{k.meals.map((m) => <td key={m} className="px-3 py-[9px] text-right font-mono">{d[m] || <span className="opacity-30">·</span>}</td>)}<td className="px-4 py-[9px] text-right font-mono font-semibold">{d.total}</td></tr>)}
            {k.diets.length > 0 && <tr className="border-t-2 border-[color:var(--line)] bg-[color:var(--subtle)] font-semibold"><td className="px-4 py-[9px]">All diets</td>{k.meals.map((m) => <td key={m} className="px-3 py-[9px] text-right font-mono">{k.totals[m]}</td>)}<td className="px-4 py-[9px] text-right font-mono">{Object.values(k.totals).reduce((a, b) => a + b, 0)}</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">Ward sheets</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {k.wards.map((w) => <div key={w.ward} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3"><p className="text-[14px] font-medium">{w.ward}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{w.patients} patients · {w.meals} meals</p><p className={`mt-1 text-[13px] font-medium ${TONE[w.sheet] ?? ""}`}>{w.sheet}</p></div>)}
        {k.wards.length === 0 && <p className="text-[13px] text-[color:var(--ink-soft)]">No ward has a diet order yet.</p>}
      </div>
    </div>
  );
}
