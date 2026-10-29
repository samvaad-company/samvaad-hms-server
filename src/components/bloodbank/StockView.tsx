"use client";

/**
 * Stock: usable units per ABO × Rh group (and how many expire within a week), then every unit — number, group,
 * component, volume, expiry, the five serology flags and what can be done next. Click a group card to filter.
 */
import { useState } from "react";
import { FlaskConical, GitFork, Plus, Trash2 } from "lucide-react";
import { useItem, useList } from "@/lib/api/hooks";
import { useHydrated } from "@/lib/use-hydrated";
import { usePagination } from "@/components/shared/Pagination";
import type { BloodStockSummaryDTO, BloodUnitDTO } from "@/types/api";
import { CollectDialog, DiscardDialog, ProcessDialog, SerologyDialog } from "@/components/bloodbank/UnitDialogs";
import { btn, Empty, mono, Pill, SectionHead, SerologyFlags, td, th } from "@/components/bloodbank/shared";

const STATUSES = ["All", "Quarantined", "Available", "Cross-matched", "Issued", "Discarded"] as const;

export function StockView({ canWrite }: { canWrite: boolean }) {
  const hydrated = useHydrated();
  const { item: summary, reload: reloadSummary } = useItem<BloodStockSummaryDTO>("/blood-bank/stock");
  const { items: units, reload: reloadUnits, loading } = useList<BloodUnitDTO>("/blood-bank/units", { all: true });
  const [group, setGroup] = useState<string>("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("All");
  const [collecting, setCollecting] = useState(false);
  const [serologyFor, setSerologyFor] = useState<BloodUnitDTO | null>(null);
  const [processFor, setProcessFor] = useState<BloodUnitDTO | null>(null);
  const [discardFor, setDiscardFor] = useState<BloodUnitDTO | null>(null);
  const reload = () => { reloadSummary(); reloadUnits(); };

  const shown = units.filter((u) => (!group || u.bloodGroup === group) && (status === "All" || u.status === status));
  const { rows, bar } = usePagination(shown, "units");
  const countOf = (s: (typeof STATUSES)[number]) => units.filter((u) => (!group || u.bloodGroup === group) && (s === "All" || u.status === s)).length;

  return (
    <div>
      <SectionHead title="Available inventory (ABO × Rh)"
        action={hydrated && canWrite ? <button onClick={() => setCollecting(true)} className={btn.primary}><Plus size={14} /> Collect unit</button> : undefined} />

      <div className="grid gap-3 px-5 pb-4" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {(summary?.groups ?? []).map((g) => (
          <button key={g.bloodGroup} type="button" onClick={() => setGroup(group === g.bloodGroup ? "" : g.bloodGroup)} aria-pressed={group === g.bloodGroup}
            title={Object.entries(g.byComponent).map(([c, n]) => `${n} ${c}`).join(" · ") || "No usable units"}
            className={`text-left rounded-[10px] border px-4 py-3 cursor-pointer transition-colors bg-[color:var(--surface)] hover:bg-[color:var(--faint)] ${group === g.bloodGroup ? "border-[color:var(--brand)] border-2" : "border-[color:var(--line)]"}`}>
            <p className="font-mono text-[12px] text-[color:var(--ink)]">{g.bloodGroup.replace("-", "–")}</p>
            <p className="font-mono text-[26px] font-bold leading-[32px] text-[color:var(--ink)]">{g.available}</p>
            <p className="h-[18px] font-mono text-[12px] text-[#c8001a]">{g.expiringSoon > 0 ? `${g.expiringSoon} expiring ≤7d` : ""}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap px-5 pb-3">
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
            className={`inline-flex items-center gap-[6px] h-[28px] px-3 rounded-full border text-[12px] cursor-pointer transition-colors ${status === s ? "bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--surface)]" : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
            {s} <span className="font-mono text-[11px] opacity-70">{countOf(s)}</span>
          </button>
        ))}
        {group && <button onClick={() => setGroup("")} className="text-[12px] text-[color:var(--brand)] hover:underline cursor-pointer">Clear {group}</button>}
        {summary && summary.expiredInStock > 0 && <span className="ml-auto text-[12px] text-[#c8001a]">{summary.expiredInStock} expired {summary.expiredInStock === 1 ? "unit is" : "units are"} still on the shelf — discard them.</span>}
      </div>

      <div className="mx-5 mb-4 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[980px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">
            {["Unit", "Group", "Component", "Vol (ml)", "Expiry", "Serology", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((u) => {
              const open = u.status === "Quarantined" || u.status === "Available" || u.status === "Cross-matched";
              return (
                <tr key={u.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                  <td className={`${td} ${mono}`}>{u.unitNo}</td>
                  <td className={td}>{u.bloodGroup}</td>
                  <td className={td}>{u.component}</td>
                  <td className={`${td} ${mono}`}>{u.volumeMl.toFixed(2)}</td>
                  <td className={`${td} ${mono} ${u.expired && ["Available", "Quarantined", "Cross-matched"].includes(u.status) ? "text-[#c8001a] font-semibold" : ""}`}
                    title={u.expired ? `Expired ${-u.daysToExpiry} days ago` : `${u.daysToExpiry} days left`}>{u.expiryOn}</td>
                  <td className={td}><SerologyFlags s={u.serology} /></td>
                  <td className={td}><Pill tone={u.status}>{u.status}</Pill></td>
                  <td className={`${td} text-right`}>
                    {canWrite && open && (
                      <div className="flex justify-end gap-2">
                        {u.status === "Quarantined" && <button onClick={() => setSerologyFor(u)} className={`${btn.base} ${btn.ghost}`}><FlaskConical size={12} /> Serology</button>}
                        {u.component === "Whole blood" && u.status !== "Cross-matched" && !u.expired && <button onClick={() => setProcessFor(u)} className={`${btn.base} ${btn.ghost}`}><GitFork size={12} /> Process</button>}
                        <button onClick={() => setDiscardFor(u)} className={`${btn.base} ${btn.danger}`}><Trash2 size={12} /> Discard</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && shown.length === 0 && <Empty>{units.length === 0 ? "No units yet — collect the first one." : "No units match."}</Empty>}
      </div>
      {bar}

      <CollectDialog open={collecting} onClose={() => setCollecting(false)} onDone={reload} />
      <SerologyDialog key={`s${serologyFor?.id}`} unit={serologyFor} onClose={() => setSerologyFor(null)} onDone={reload} />
      <ProcessDialog key={`p${processFor?.id}`} unit={processFor} onClose={() => setProcessFor(null)} onDone={reload} />
      <DiscardDialog key={`d${discardFor?.id}`} unit={discardFor} onClose={() => setDiscardFor(null)} onDone={reload} />
    </div>
  );
}
