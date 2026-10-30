"use client";

import { useState } from "react";
import { useItem } from "@/lib/api/hooks";
import type { AmbulanceDashboardDTO } from "@/types/api";
import { inr } from "./shared";

const RANGES = [7, 30, 90] as const;
const dm = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const mins = (n: number | null) => (n === null ? "—" : `${n} min`);
const card = "rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3";
const Stat = ({ label, value, sub, bad }: { label: string; value: string | number; sub?: string; bad?: boolean }) => (
  <div className={card}><p className="text-[13px] text-[color:var(--ink-soft)]">{label}</p><p className={`mt-1 font-mono text-[24px] font-bold leading-8 ${bad ? "text-[#d10024]" : ""}`}>{value}</p>{sub && <p className="text-[12px] text-[color:var(--ink-soft)]">{sub}</p>}</div>
);

/** Calls, response times, call types and how busy each vehicle was. */
export function AmbulanceDashboard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { item } = useItem<AmbulanceDashboardDTO>(`/ambulance/dashboard?days=${days}`);
  const [last, setLast] = useState<AmbulanceDashboardDTO | null>(null);
  if (item && item !== last) setLast(item);
  const d = item ?? last;
  if (!d) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const max = Math.max(1, ...d.series.map((s) => s.calls));
  const every = Math.ceil(d.series.length / 10);
  const typeMax = Math.max(1, ...d.byType.map((t) => t.count));
  const vehMax = Math.max(1, ...d.byVehicle.map((v) => v.calls));
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-[color:var(--ink-soft)]">{dm(d.from)} – {dm(d.to)}</p>
        <div role="radiogroup" aria-label="Period" className="flex rounded-[8px] bg-[color:var(--subtle-2)] p-[3px]">
          {RANGES.map((r) => <button key={r} role="radio" aria-checked={days === r} onClick={() => setDays(r)} className={`cursor-pointer rounded-[6px] px-3 py-[4px] text-[13px] ${days === r ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{r} days</button>)}
        </div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Stat label="Calls" value={d.calls.total} sub={`${d.calls.completed} completed · ${d.calls.cancelled} cancelled`} />
        <Stat label="Active now" value={d.calls.active} sub={d.calls.queued ? `${d.calls.queued} queued, no vehicle` : "none queued"} bad={d.calls.queued > 0} />
        <Stat label="Fares (completed)" value={inr(d.calls.revenue)} />
        <Stat label="Avg dispatch time" value={mins(d.response.dispatchMin)} sub="call opened → vehicle sent" />
        <Stat label="Avg time to scene" value={mins(d.response.sceneMin)} sub={`trip ${mins(d.response.tripMin)}`} />
      </div>
      <h2 className="mb-2 mt-6 text-[13px] font-semibold text-[color:var(--ink-soft)]">Calls by day</h2>
      <div className={card}>
        <div className="flex h-[110px] items-end gap-[3px]" role="img" aria-label="Calls each day">
          {d.series.map((s) => <div key={s.date} className="flex-1 rounded-t-[3px] bg-[color:var(--brand)] opacity-70" title={`${dm(s.date)} — ${s.calls} calls`} style={{ height: `${Math.max(s.calls > 0 ? 4 : 0, (s.calls / max) * 100)}%` }} />)}
        </div>
        <div className="mt-1 flex gap-[3px] text-[10px] text-[color:var(--ink-soft)]">{d.series.map((s, i) => <span key={s.date} className="flex-1 whitespace-nowrap text-center">{i % every === 0 ? dm(s.date) : ""}</span>)}</div>
      </div>
      <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <section className={card}>
          <h2 className="mb-3 text-[13px] font-semibold">By call type</h2>
          {d.byType.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No calls in this period.</p> : d.byType.map((t) => (
            <div key={t.type} className="mb-[6px] flex items-center gap-3 text-[12px]"><span className="w-40 shrink-0 truncate text-[color:var(--ink-soft)]">{t.type}</span><span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${(t.count / typeMax) * 100}%` }} /></span><span className="w-8 text-right font-mono">{t.count}</span></div>
          ))}
        </section>
        <section className={card}>
          <h2 className="mb-1 text-[13px] font-semibold">By vehicle <span className="ml-2 font-normal text-[color:var(--ink-soft)]">{d.fleet.available} available · {d.fleet.dispatched} dispatched · {d.fleet.offRoad} off road</span></h2>
          <div className="mt-3">{d.byVehicle.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No vehicles.</p> : d.byVehicle.map((v) => (
            <div key={v.code} className="mb-[6px] flex items-center gap-3 text-[12px]"><span className="w-16 shrink-0 font-mono font-bold">{v.code}</span><span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full bg-[#12a150]" style={{ width: `${(v.calls / vehMax) * 100}%` }} /></span><span className="w-24 text-right font-mono">{v.calls} ({v.completed} done)</span></div>
          ))}</div>
        </section>
      </div>
    </div>
  );
}
