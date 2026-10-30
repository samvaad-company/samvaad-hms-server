"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import type { AnalyticsDTO, AnalyticsRange, AnalyticsTrendStat } from "@/types/api";
import { TrendChart } from "./TrendChart";
import { inr, inrExact } from "./format";

const RANGES: { id: AnalyticsRange; label: string; against: string }[] = [
  { id: "day", label: "Day", against: "vs yesterday" }, { id: "week", label: "Week", against: "vs last week" }, { id: "month", label: "Month", against: "vs last month" },
];

function Change({ stat, against }: { stat: AnalyticsTrendStat; against: string }) {
  if (stat.change === null) return <p className="text-[12px] text-[color:var(--ink-soft)]">no comparison yet</p>;
  const up = stat.change >= 0;
  return (
    <p className="flex items-center gap-[6px] text-[12px] text-[color:var(--ink-soft)]">
      <span className={`inline-flex items-center gap-[3px] rounded-[5px] px-[6px] py-[1px] font-mono font-semibold ${up ? "bg-[#dffff3] text-[#0b7a47]" : "bg-[#ffe9e9] text-[#c8001a]"}`}>
        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(stat.change)}%
      </span>
      {against}
    </p>
  );
}

function Tiles({ title, items, cols = 4 }: { title: string; items: { label: string; value: string | number; sub?: string; bad?: boolean }[]; cols?: number }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[13px] font-semibold text-[color:var(--ink-soft)]">{title}</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((t) => (
          <div key={t.label} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
            <p className="text-[13px] text-[color:var(--ink-soft)]">{t.label}</p>
            <p className={`mt-1 font-mono text-[24px] font-bold leading-8 ${t.bad ? "text-[#d10024]" : "text-[color:var(--ink)]"}`}>{t.value}</p>
            {t.sub && <p className="text-[12px] text-[color:var(--ink-soft)]">{t.sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Reports → Analytics → Dashboard: the trend with the period compared to the last, then today's figures by area. */
export function AnalyticsDashboard({ reloadKey = 0 }: { reloadKey?: number }) {
  const [range, setRange] = useState<AnalyticsRange>("day");
  const { item, error } = useItem<AnalyticsDTO>(`/analytics?range=${range}&r=${reloadKey}`);
  // Keep the last figures on screen while the next range loads, so the page doesn't blank on every switch.
  const [last, setLast] = useState<AnalyticsDTO | null>(null);
  if (item && item !== last) setLast(item);
  const a = item ?? last;
  const against = RANGES.find((r) => r.id === range)!.against;

  if (!a) return <p className="px-5 py-10 text-[14px] text-[color:var(--ink-soft)]">{error ? "The analytics couldn't be loaded." : "Loading…"}</p>;
  return (
    <div className="px-5 pb-6 pt-4">
      <p className="mb-4 text-[13px] text-[color:var(--ink-soft)]">As of today ({a.today}, IST) · all branches</p>
      <section className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-[15px] font-semibold">Trends <span className="ml-1 text-[13px] font-normal text-[color:var(--ink-soft)]">{a.rangeNote}</span></h2>
          <div role="radiogroup" aria-label="Trend period" className="flex rounded-[8px] bg-[color:var(--subtle-2)] p-[3px]">
            {RANGES.map((r) => (
              <button key={r.id} role="radio" aria-checked={range === r.id} onClick={() => setRange(r.id)}
                className={`cursor-pointer rounded-[6px] px-3 py-[4px] text-[13px] ${range === r.id ? "bg-[color:var(--surface)] font-medium text-[color:var(--ink)] shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{r.label}</button>
            ))}
          </div>
        </div>
        <div className="grid border-y border-[color:var(--line)]" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {a.stats.map((s, i) => (
            <div key={s.key} className={`px-5 py-3 ${i > 0 ? "border-l border-[color:var(--line)]" : ""}`}>
              <p className="text-[12px] text-[color:var(--ink-soft)]">{s.label}</p>
              <p className="my-1 font-mono text-[22px] font-bold leading-7">{s.value === null ? "-" : s.kind === "money" ? inr(s.value) : s.value.toLocaleString("en-IN")}</p>
              <Change stat={s} against={against} />
            </div>
          ))}
        </div>
        <div className="px-4 pb-3 pt-4"><TrendChart series={a.series} /></div>
      </section>

      <Tiles title="Revenue (today)" cols={4} items={[
        { label: "Collected", value: inrExact(a.revenue.collected) }, { label: "Bills raised", value: a.revenue.billsRaised },
        { label: "Outstanding", value: inrExact(a.revenue.outstanding), bad: a.revenue.outstanding > 0 },
      ]} />
      <Tiles title="OPD (today)" items={[
        { label: "Appointments", value: a.opd.appointments }, { label: "Arrived", value: a.opd.arrived }, { label: "Completed", value: a.opd.completed }, { label: "No-show", value: a.opd.noShow },
      ]} />
      <Tiles title="IPD & beds" items={[
        { label: "Currently admitted", value: a.ipd.admitted }, { label: "Admissions today", value: a.ipd.admissionsToday }, { label: "Discharges today", value: a.ipd.dischargesToday },
        { label: "Bed occupancy", value: `${a.ipd.occupancyPct}%`, sub: `${a.ipd.occupied}/${a.ipd.beds} occupied` },
      ]} />
      <Tiles title="Pharmacy & lab" items={[
        { label: "Low stock", value: a.stores.lowStock, bad: a.stores.lowStock > 0 }, { label: "Near expiry (90d)", value: a.stores.nearExpiry, bad: a.stores.nearExpiry > 0 },
        { label: "Lab pending", value: a.stores.labPending }, { label: "Lab reported today", value: a.stores.labReportedToday },
      ]} />
    </div>
  );
}
