"use client";

/** Timeline: every step of the stay from each department, in order, with the wait between steps. */
import { useMemo, useState } from "react";
import { useItem } from "@/lib/api/hooks";
import type { IpdTimelineDTO, IpdTimelineKind } from "@/types/api";
import { Pill, btn, dateTime, spanLabel } from "@/components/ipd/patient/ui";
import type { ChartCtx } from "@/components/ipd/patient/ui";

const TONE: Record<IpdTimelineKind, "neutral" | "ok" | "warn" | "bad" | "info"> = { Admission: "info", Medication: "neutral", Vitals: "neutral", Note: "neutral", IV: "info", Fluids: "info", Billing: "warn", Consent: "neutral", Insurance: "info", Discharge: "ok" };
const FILTERS: ("Everything" | IpdTimelineKind)[] = ["Everything", "Admission", "Medication", "Vitals", "Note", "IV", "Fluids", "Insurance", "Billing", "Consent"];

export function TimelineTab({ ctx }: { ctx: ChartCtx }) {
  const { item, loading } = useItem<IpdTimelineDTO>(`/ipd/${ctx.id}/timeline`);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Everything");
  const shown = useMemo(() => (item?.events ?? []).filter((e) => filter === "Everything" || e.kind === filter), [item, filter]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const e of item?.events ?? []) c[e.kind] = (c[e.kind] ?? 0) + 1; return c; }, [item]);
  if (loading || !item) return <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading the timeline…</p>;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-6 text-[13px]">
          <div><p className="text-[11px] text-[color:var(--ink-soft)]">Time in hospital</p><p className="font-mono text-[15px] font-semibold text-[color:var(--ink)]">{spanLabel(item.timeInHospitalMin)}</p></div>
          {item.longestWaitMin > 0 && <div><p className="text-[11px] text-[color:var(--ink-soft)]">Longest single wait</p><p className="font-mono text-[15px] font-semibold text-[color:var(--ink)]">{item.longestWaitLabel}</p></div>}
        </div>
        <p className="max-w-[360px] text-right text-[12px] text-[color:var(--ink-soft)]">Every step of the stay from each department, in order — nothing here is stored separately, so it can&apos;t disagree with them.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => f === "Everything" || counts[f]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`${btn.base} ${filter === f ? btn.solid : btn.ghost}`}>{f === "Note" ? "Notes" : f}{f !== "Everything" ? ` · ${counts[f]}` : ""}</button>
        ))}
      </div>

      {shown.length === 0 ? <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing here.</p> : (
        <ol className="relative flex flex-col border-l border-[color:var(--line)] pl-5">
          {shown.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative pb-3">
              <span className="absolute -left-[26px] top-[5px] h-[9px] w-[9px] rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--ink-soft)]" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-[2px]">
                <span className="w-[130px] shrink-0 font-mono text-[12px] text-[color:var(--ink-soft)]">{dateTime(e.at)}</span>
                <span className="text-[13px] text-[color:var(--ink)]">{e.title}</span>
                <Pill tone={TONE[e.kind]}>{e.kind}</Pill>
              </div>
              <p className="pl-[142px] text-[11px] text-[color:var(--ink-soft)]">
                {e.detail ? `${e.detail}${e.by ? " · " : ""}` : ""}{e.by}
                {e.sincePrevMin != null && filter === "Everything" ? `${e.detail || e.by ? " · " : ""}${spanLabel(e.sincePrevMin)} after the previous step` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
