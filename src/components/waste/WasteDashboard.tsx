"use client";

import { useState } from "react";
import { useItem } from "@/lib/api/hooks";
import type { WasteDashboardDTO } from "@/types/api";
import { CATEGORY_BAR, CategoryChip, Stat, kg } from "./shared";

const RANGES = [7, 30, 90] as const;
const dm = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Bars({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-[13px] text-[color:var(--ink-soft)]">Nothing recorded in this period.</p>;
  return <>{rows.map((r) => (
    <div key={r.label} className="mb-[6px] flex items-center gap-3 text-[12px]">
      <span className="w-32 shrink-0 truncate text-[color:var(--ink-soft)]" title={r.label}>{r.label}</span>
      <span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${(r.value / max) * 100}%` }} /></span>
      <span className="w-20 text-right font-mono">{unit === "kg" ? kg(r.value) : r.value}</span>
    </div>
  ))}</>;
}

/** The period at a glance: waste by colour, ward and day, what's waiting for disposal, infections and hand hygiene. */
export function WasteDashboard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { item } = useItem<WasteDashboardDTO>(`/waste/dashboard?days=${days}`);
  const [last, setLast] = useState<WasteDashboardDTO | null>(null);
  if (item && item !== last) setLast(item);
  const d = item ?? last;
  if (!d) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const max = Math.max(1, ...d.waste.series.map((s) => s.kg));
  const every = Math.ceil(d.waste.series.length / 10);
  const waiting = d.waste.byCategory.reduce((n, c) => n + Math.max(0, c.pending), 0);
  const card = "rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3";
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-[color:var(--ink-soft)]">{dm(d.from)} – {dm(d.to)}</p>
        <div role="radiogroup" aria-label="Period" className="flex rounded-[8px] bg-[color:var(--subtle-2)] p-[3px]">
          {RANGES.map((r) => <button key={r} role="radio" aria-checked={days === r} onClick={() => setDays(r)} className={`cursor-pointer rounded-[6px] px-3 py-[4px] text-[13px] ${days === r ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{r} days</button>)}
        </div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Stat label="Waste collected" value={`${kg(d.waste.kg)} kg`} sub={`${d.waste.bags} bags · ${d.waste.entries} entries`} />
        <Stat label="Sent for disposal" value={`${kg(d.waste.disposedKg)} kg`} />
        <Stat label="Waiting for disposal" value={`${kg(waiting)} kg`} bad={waiting > 0} sub="all time, all colours" />
        <Stat label="Open infections" value={d.infection.open} bad={d.infection.open > 0} sub={`${d.infection.events} logged in the period`} />
        <Stat label="Hand hygiene" value={d.handHygiene.pct === null ? "—" : `${d.handHygiene.pct}%`} bad={d.handHygiene.pct !== null && d.handHygiene.pct < 80} sub={`${d.handHygiene.audits} audits`} />
      </div>

      <h2 className="mb-2 mt-6 text-[13px] font-semibold text-[color:var(--ink-soft)]">Waste by day</h2>
      <div className={card}>
        <div className="flex h-[130px] items-end gap-[3px]" role="img" aria-label="Waste collected each day">
          {d.waste.series.map((s) => <div key={s.date} className="flex-1 rounded-t-[3px] bg-[color:var(--brand)] opacity-70" title={`${dm(s.date)} — ${kg(s.kg)} kg`} style={{ height: `${Math.max(s.kg > 0 ? 3 : 0, (s.kg / max) * 100)}%` }} />)}
        </div>
        <div className="mt-1 flex gap-[3px] text-[10px] text-[color:var(--ink-soft)]">{d.waste.series.map((s, i) => <span key={s.date} className="flex-1 whitespace-nowrap text-center">{i % every === 0 ? dm(s.date) : ""}</span>)}</div>
      </div>

      <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <section className={card}>
          <h2 className="mb-3 text-[13px] font-semibold">By colour</h2>
          {d.waste.byCategory.map((c) => (
            <div key={c.category} className="mb-[8px] flex items-center gap-3 text-[13px]">
              <span className="w-[230px] shrink-0"><CategoryChip category={c.category} label={c.label} /></span>
              <span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full" style={{ width: `${(c.kg / Math.max(1, d.waste.kg)) * 100}%`, background: CATEGORY_BAR[c.category] }} /></span>
              <span className="w-20 text-right font-mono">{kg(c.kg)} kg</span>
            </div>
          ))}
        </section>
        <section className={card}><h2 className="mb-3 text-[13px] font-semibold">By ward (kg)</h2><Bars unit="kg" rows={d.waste.byWard.map((w) => ({ label: w.ward, value: w.kg }))} /></section>
        <section className={card}><h2 className="mb-3 text-[13px] font-semibold">Infections by type</h2><Bars unit="" rows={d.infection.byType.map((t) => ({ label: t.type, value: t.count }))} /></section>
        <section className={card}>
          <h2 className="mb-3 text-[13px] font-semibold">Hand hygiene by ward</h2>
          {d.handHygiene.byWard.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No audits in this period.</p> : d.handHygiene.byWard.map((w) => (
            <div key={w.ward} className="mb-[6px] flex items-center gap-3 text-[12px]"><span className="w-32 shrink-0 truncate text-[color:var(--ink-soft)]">{w.ward}</span><span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full" style={{ width: `${w.pct}%`, background: w.pct < 80 ? "#d9364a" : "#12a150" }} /></span><span className="w-16 text-right font-mono">{w.pct}%</span></div>
          ))}
        </section>
      </div>
    </div>
  );
}
