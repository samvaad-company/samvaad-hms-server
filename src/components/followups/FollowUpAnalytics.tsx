"use client";

/**
 * Follow-up analytics: how many follow-ups were booked per day, how many are done, missed, or due and not
 * yet marked, and how much of that is down to the doctor versus the receptionist. A patient who stays away
 * is marked Missed; one whose date has passed with no mark is "due".
 */
import { useState, type ReactNode } from "react";
import { useItem, useList } from "@/lib/api/hooks";
import { formatDate } from "@/lib/dates";
import type { DoctorDTO, FollowUpAnalyticsDTO } from "@/types/api";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { StackedBars, type Bar, type Series } from "./StackedBars";

const PERIODS = [{ days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 180, label: "180 days" }, { days: 365, label: "12 months" }] as const;

const SERIES: Series[] = [
  { key: "done", label: "Done", color: "#16a34a" },
  { key: "missed", label: "Missed", color: "#e0001b" },
  { key: "due", label: "Due, not completed", color: "#f59e0b" },
  { key: "upcoming", label: "Upcoming", color: "#94a3b8" },
];

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

function Card({ title, value, hint, tone, className = "" }: { title: string; value: ReactNode; hint: string; tone?: "good" | "bad" | "warn"; className?: string }) {
  const color = tone === "good" ? "text-[#0f7a36]" : tone === "bad" ? "text-[#e0001b]" : tone === "warn" ? "text-[#b45309]" : "text-[color:var(--ink)]";
  return (
    <div className={`rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 ${className}`}>
      <p className="text-[12px] text-[color:var(--ink-soft)]">{title}</p>
      <p className={`mt-[2px] text-[26px] leading-[32px] font-semibold font-mono ${color}`}>{value}</p>
      <p className="text-[11.5px] text-[color:var(--ink-soft)] leading-[15px]">{hint}</p>
    </div>
  );
}

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] ${className}`}>
      <header className="px-4 py-3 border-b border-[color:var(--line)] flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold text-[color:var(--ink)]">{title}</h3>
        {sub && <span className="text-[11.5px] text-[color:var(--ink-soft)]">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

const th = "px-4 py-2 text-[11.5px] font-medium text-[color:var(--ink-soft)] text-right first:text-left whitespace-nowrap";
const td = "px-4 py-[7px] text-[12.5px] text-[color:var(--ink)] text-right first:text-left font-mono first:font-sans whitespace-nowrap";

export function FollowUpAnalytics() {
  const [days, setDays] = useState<number>(90);
  const [doctor, setDoctor] = useState("all");
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { item: a, loading, error } = useItem<FollowUpAnalyticsDTO>(`/followups/analytics?days=${days}${doctor !== "all" ? `&doctorId=${doctor}` : ""}`);

  const bars: Bar[] = (a?.buckets ?? []).map(b => ({
    key: b.key,
    label: a?.period.bucket === "week" ? `Wk of ${b.label}` : b.label,
    values: { done: b.done, missed: b.missed, due: b.due, upcoming: b.upcoming },
  }));
  const t = a?.totals;
  const role = (r: string) => a?.byRole.find(x => x.role === r);
  const activeDays = (a?.buckets ?? []).filter(b => b.total > 0).slice().reverse();

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-[200px]">
          <SearchSelect placeholder="All doctors" value={doctor} onChange={setDoctor}
            options={[{ value: "all", label: "All doctors" }, ...doctors.map(d => ({ value: String(d.id), label: d.name, hint: d.specialty }))]} />
        </div>
        <div role="group" aria-label="Period" className="inline-flex items-center p-[2px] rounded-[10px] bg-[color:var(--subtle)]">
          {PERIODS.map(p => (
            <button key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
              className={`h-[26px] px-3 rounded-[8px] text-[12px] cursor-pointer transition-colors ${days === p.days ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {t && (
          <p className="text-[12px] text-[color:var(--ink-soft)]">
            Missed <b className="font-mono text-[#e0001b]">{pct(t.missedRate)}</b> · Kept <b className="font-mono text-[#0f7a36]">{pct(t.keptRate)}</b>
            <span className="ml-2">{formatDate(a!.period.from)} – {formatDate(a!.period.to)}</span>
          </p>
        )}
      </div>

      {error ? (
        <p className="text-[13px] text-[#e0001b]">Couldn&apos;t load the analytics. {error.message}</p>
      ) : loading && !a ? (
        <p className="py-12 text-center text-[13px] text-[color:var(--ink-soft)]">Loading analytics…</p>
      ) : a && t ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card title="Follow-ups booked" value={t.scheduled} hint={`Due in the last ${a.period.days === 365 ? "12 months" : `${a.period.days} days`}`} />
            <Card title="Due, not completed" value={t.due} tone={t.due ? "warn" : undefined} hint="Date reached, not marked done or missed" />
            <Card title="Done" value={t.done} tone="good" hint="Patient came back" />
            <Card title="Missed" value={t.missed} tone={t.missed ? "bad" : undefined} hint="Patient was absent" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card title="Follow-ups kept" value={pct(t.keptRate)} tone="good" hint={`${t.done} done of ${t.done + t.missed} marked`} />
            <Card title="Missed rate" value={pct(t.missedRate)} tone={t.missedRate ? "bad" : undefined} hint={`${t.missed} missed of ${t.done + t.missed} marked`} />
            <Card title="Next 14 days" value={t.next14} hint="Booked and still to come" />
            <Card title="Booked by" value={<span className="text-[20px]">{role("Doctor")?.booked ?? 0} <span className="text-[12px] font-sans font-normal text-[color:var(--ink-soft)]">doctor</span> · {role("Receptionist")?.booked ?? 0} <span className="text-[12px] font-sans font-normal text-[color:var(--ink-soft)]">desk</span></span>} hint="Doctor vs receptionist" />
          </div>

          <Panel title="Follow-ups per day" sub={a.period.bucket === "week" ? "grouped by week · by due date" : "by due date"}>
            <div className="px-4 py-4">
              {t.scheduled === 0 ? <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">No follow-ups fell due in this period.</p> : <StackedBars bars={bars} series={SERIES} />}
            </div>
          </Panel>

          <div className="grid lg:grid-cols-2 gap-3">
            <Panel title="Who booked and who marked" sub="doctor vs receptionist">
              <table className="w-full">
                <thead><tr><th className={th}>Role</th><th className={th}>Booked</th><th className={th}>Marked done</th><th className={th}>Marked missed</th></tr></thead>
                <tbody>
                  {a.byRole.map(r => (
                    <tr key={r.role} className="border-t border-[color:var(--line)]">
                      <td className={td}>{r.role}</td><td className={td}>{r.booked}</td>
                      <td className={`${td} text-[#0f7a36]`}>{r.markedDone}</td><td className={`${td} ${r.markedMissed ? "text-[#e0001b]" : ""}`}>{r.markedMissed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="By doctor" sub={`last ${a.period.days === 365 ? "12 months" : `${a.period.days} days`}`}>
              <div className="max-h-[220px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[color:var(--surface)]"><tr><th className={th}>Doctor</th><th className={th}>Booked</th><th className={th}>Done</th><th className={th}>Missed</th><th className={th}>Due</th><th className={th}>Kept</th></tr></thead>
                  <tbody>
                    {a.byDoctor.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-[12.5px] text-[color:var(--ink-soft)]">No data</td></tr> : a.byDoctor.map(d => (
                      <tr key={d.doctorId ?? d.doctor} className="border-t border-[color:var(--line)]">
                        <td className={td}>{d.doctor}</td><td className={td}>{d.total}</td><td className={`${td} text-[#0f7a36]`}>{d.done}</td>
                        <td className={`${td} ${d.missed ? "text-[#e0001b]" : ""}`}>{d.missed}</td><td className={`${td} ${d.due ? "text-[#b45309]" : ""}`}>{d.due}</td><td className={td}>{pct(d.keptRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel title={a.period.bucket === "week" ? "Follow-ups per week" : "Follow-ups per day"} sub={`${activeDays.length} ${a.period.bucket === "week" ? "weeks" : "days"} with follow-ups, latest first`}>
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-[color:var(--surface)]">
                  <tr><th className={th}>{a.period.bucket === "week" ? "Week of" : "Date"}</th><th className={th}>Booked</th><th className={th}>Done</th><th className={th}>Missed</th><th className={th}>Due, not completed</th><th className={th}>Upcoming</th><th className={th}>Kept</th></tr>
                </thead>
                <tbody>
                  {activeDays.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-[12.5px] text-[color:var(--ink-soft)]">Nothing in this period.</td></tr> : activeDays.map(b => (
                    <tr key={b.key} className="border-t border-[color:var(--line)] hover:bg-[color:var(--faint)]">
                      <td className={td}>{formatDate(b.key)}</td><td className={td}>{b.total}</td>
                      <td className={`${td} ${b.done ? "text-[#0f7a36]" : "text-[color:var(--ink-soft)]"}`}>{b.done}</td>
                      <td className={`${td} ${b.missed ? "text-[#e0001b]" : "text-[color:var(--ink-soft)]"}`}>{b.missed}</td>
                      <td className={`${td} ${b.due ? "text-[#b45309]" : "text-[color:var(--ink-soft)]"}`}>{b.due}</td>
                      <td className={`${td} text-[color:var(--ink-soft)]`}>{b.upcoming}</td>
                      <td className={td}>{b.done + b.missed ? pct(Math.round((b.done / (b.done + b.missed)) * 1000) / 10) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
