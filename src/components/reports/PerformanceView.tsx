"use client";

/**
 * Reports → AI monitor → Hospital performance. How the hospital is doing and growing over a period you choose, set against the
 * stretch before it (or the same stretch last year): growth, patients, appointments, follow-ups, retention, billing and revenue.
 * Filters (period, comparison, grouping, doctor, kind of bill, kind of visit) and the choice of which sections to show are
 * remembered for the next visit, so the page opens the way each person likes it.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, RotateCcw, SlidersHorizontal, Check } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useItem } from "@/lib/api/hooks";
import type { PerfKpi, PerformanceDTO } from "@/types/api";
import { TrendChart } from "./TrendChart";
import { inr, inrShort } from "./format";

// ── Filters ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Preset = "today" | "7d" | "30d" | "90d" | "month" | "lastMonth" | "year" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" }, { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "90d", label: "90 days" },
  { id: "month", label: "This month" }, { id: "lastMonth", label: "Last month" }, { id: "year", label: "This year" }, { id: "custom", label: "Custom" },
];
interface Filters { preset: Preset; from: string; to: string; compare: "previous" | "year" | "none"; interval: "auto" | "day" | "week" | "month"; doctorId: string; billType: string; visitType: string }

const iso = (d: Date): string => d.toLocaleDateString("en-CA");
const addDays = (s: string, n: number): string => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const dmy = (s: string): string => new Date(`${s}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function rangeFor(p: Preset, today: string, custom: { from: string; to: string }): { from: string; to: string } {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  switch (p) {
    case "today": return { from: today, to: today };
    case "7d": return { from: addDays(today, -6), to: today };
    case "30d": return { from: addDays(today, -29), to: today };
    case "90d": return { from: addDays(today, -89), to: today };
    case "month": return { from: `${today.slice(0, 8)}01`, to: today };
    case "lastMonth": { const first = new Date(y, m - 2, 1), last = new Date(y, m - 1, 0); return { from: iso(first), to: iso(last) }; }
    case "year": return { from: `${y}-01-01`, to: today };
    default: return custom;
  }
}

const FILTERS_KEY = "hms-performance-filters";
const VIEW_KEY = "hms-performance-view";
const DEFAULTS: Filters = { preset: "30d", from: "", to: "", compare: "previous", interval: "auto", doctorId: "", billType: "", visitType: "" };

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...(JSON.parse(raw) as object) } as T : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not saved */ } }

// ── Which sections to show ───────────────────────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "growth", label: "Hospital growth" },
  { id: "patients", label: "Patients" },
  { id: "appointments", label: "Appointments" },
  { id: "followups", label: "Follow-ups" },
  { id: "billing", label: "Billing & revenue" },
  { id: "ipd", label: "IPD" },
  { id: "trend", label: "Trend chart" },
  { id: "retention", label: "Retention" },
  { id: "revenue", label: "Revenue by bill type" },
  { id: "doctors", label: "Doctors" },
  { id: "status", label: "Appointment status & follow-ups" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// ── Small pieces ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const fmtValue = (k: PerfKpi["kind"], v: number | null): string => (v === null ? "—" : k === "money" ? inr(v) : k === "pct" ? `${v}%` : v.toLocaleString("en-IN"));

/** ↑ 12% / ↓ 3.2 pts, green when it is good news and red when it is not. */
function Change({ change, unit, lowerIsBetter, className = "" }: { change: number | null; unit: "pct" | "pts"; lowerIsBetter?: boolean; className?: string }) {
  if (change === null) return <span className={`inline-flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] ${className}`}><Minus size={12} /> no comparison</span>;
  if (change === 0) return <span className={`inline-flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] ${className}`}><Minus size={12} /> no change</span>;
  const up = change > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-[2px] rounded-full px-[8px] py-[1px] text-[12px] font-medium ${good ? "bg-[#dffff3] text-[#00955c] dark:bg-[#12332a] dark:text-[#5fe0ad]" : "bg-[#ffe9e9] text-[#d4000a] dark:bg-[#3a1d1f] dark:text-[#ff9a9d]"} ${className}`}>
      <Icon size={13} /> {Math.abs(change)}{unit === "pct" ? "%" : " pts"}
    </span>
  );
}

function KpiCard({ k, comparing }: { k: PerfKpi; comparing: boolean }) {
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} px-4 py-3 min-w-0`} title={k.hint}>
      <p className="text-[12px] text-[color:var(--ink-soft)] truncate">{k.label}</p>
      <p className="mt-1 text-[22px] font-medium leading-7 text-[color:var(--ink)]">{fmtValue(k.kind, k.value)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {comparing ? <Change change={k.change} unit={k.changeUnit} lowerIsBetter={k.lowerIsBetter} /> : null}
        {comparing && k.previous !== null && <span className="text-[11px] text-[color:var(--ink-soft)]">was {fmtValue(k.kind, k.previous)}</span>}
      </div>
    </div>
  );
}

const Card = ({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) => (
  <section className={`${tw.surface.card} ${tw.radius.card} p-4 min-w-0 ${className}`}>
    <h3 className="text-[13px] font-medium text-[color:var(--ink)]">{title}{note && <span className="ml-2 text-[12px] font-normal text-[color:var(--ink-soft)]">{note}</span>}</h3>
    <div className="mt-3">{children}</div>
  </section>
);

const Bar = ({ label, value, max, text, color = "var(--brand)" }: { label: string; value: number; max: number; text: string; color?: string }) => (
  <div>
    <div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="truncate text-[color:var(--ink)]">{label}</span><span className="shrink-0 text-[color:var(--ink-soft)]">{text}</span></div>
    <div className="mt-[3px] h-[6px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(value > 0 ? 3 : 0, (value / Math.max(1, max)) * 100)}%`, background: color }} /></div>
  </div>
);

const selectCls = "h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-[5px]"><span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{label}</span>{children}</label>
);

// ── The page ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function PerformanceView() {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [hidden, setHidden] = useState<SectionId[]>([]);
  const [ready, setReady] = useState(false);
  const [customising, setCustomising] = useState(false);
  const today = useMemo(() => iso(new Date()), []);

  // Pick up what this person chose last time.
  useEffect(() => {
    setFilters(load(FILTERS_KEY, DEFAULTS));
    setHidden(load<{ hidden: SectionId[] }>(VIEW_KEY, { hidden: [] }).hidden);
    setReady(true);
  }, []);
  useEffect(() => { if (ready) save(FILTERS_KEY, filters); }, [filters, ready]);
  useEffect(() => { if (ready) save(VIEW_KEY, { hidden }); }, [hidden, ready]);

  const range = rangeFor(filters.preset, today, { from: filters.from || addDays(today, -29), to: filters.to || today });
  const q = new URLSearchParams({ from: range.from, to: range.to, compare: filters.compare, interval: filters.interval });
  if (filters.doctorId) q.set("doctorId", filters.doctorId);
  if (filters.billType) q.set("billType", filters.billType);
  if (filters.visitType) q.set("visitType", filters.visitType);
  const { item, error } = useItem<PerformanceDTO>(ready ? `/analytics/performance?${q.toString()}` : null);

  // Keep the last answer on screen while the next one loads, so changing a filter doesn't blank the page.
  const [last, setLast] = useState<PerformanceDTO | null>(null);
  if (item && item !== last) setLast(item);
  const d = item ?? last;

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const show = (id: SectionId) => !hidden.includes(id);
  const toggleSection = (id: SectionId) => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  const filtered = filters.doctorId || filters.billType || filters.visitType;
  const reset = () => setFilters(DEFAULTS);

  if (!d) return <p className="px-5 py-10 text-[14px] text-[color:var(--ink-soft)]">{error ? "The performance figures couldn't be loaded." : "Loading…"}</p>;

  const comparing = d.compare !== null;
  const group = (g: PerfKpi["group"]) => d.kpis.filter((k) => k.group === g);
  const GROUPS: { id: SectionId; title: string; g: PerfKpi["group"] }[] = [
    { id: "patients", title: "Patients", g: "patients" }, { id: "appointments", title: "Appointments", g: "appointments" }, { id: "followups", title: "Follow-ups", g: "followups" },
    { id: "billing", title: "Billing & revenue", g: "billing" }, { id: "ipd", title: "IPD", g: "ipd" },
  ];
  const maxRevenue = Math.max(1, ...d.growth.months.map((x) => x.revenue));
  const maxPatients = Math.max(1, ...d.growth.months.map((x) => x.patients));
  const maxType = Math.max(1, ...d.revenueByType.map((r) => r.collected));
  const maxStatus = Math.max(1, ...d.appointmentsByStatus.map((s) => s.count));
  const compareLabel = d.compare ? `${dmy(d.compare.from)} – ${dmy(d.compare.to)}` : "";

  return (
    <div className="px-4 sm:px-5 pb-6 pt-4 flex flex-col gap-5">
      {/* Filters */}
      <section className={`${tw.surface.card} ${tw.radius.card} p-4 flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Period">
          {PRESETS.map((p) => (
            <button key={p.id} aria-pressed={filters.preset === p.id} onClick={() => set(p.id === "custom" ? { preset: "custom", from: range.from, to: range.to } : { preset: p.id })}
              className={`h-[30px] rounded-full border px-3 text-[13px] cursor-pointer transition-colors ${filters.preset === p.id ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)] font-medium" : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {filters.preset === "custom" && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
            <Field label="From"><input type="date" max={filters.to || today} value={filters.from} onChange={(e) => set({ from: e.target.value })} className={selectCls} /></Field>
            <Field label="To"><input type="date" max={today} min={filters.from} value={filters.to} onChange={(e) => set({ to: e.target.value })} className={selectCls} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Compare with">
            <select value={filters.compare} onChange={(e) => set({ compare: e.target.value as Filters["compare"] })} className={selectCls}>
              <option value="previous">Previous period</option><option value="year">Same period last year</option><option value="none">No comparison</option>
            </select>
          </Field>
          <Field label="Group by">
            <select value={filters.interval} onChange={(e) => set({ interval: e.target.value as Filters["interval"] })} className={selectCls}>
              <option value="auto">Automatic</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option>
            </select>
          </Field>
          <Field label="Doctor">
            <select value={filters.doctorId} onChange={(e) => set({ doctorId: e.target.value })} className={selectCls}>
              <option value="">All doctors</option>{d.options.doctors.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Bill type">
            <select value={filters.billType} onChange={(e) => set({ billType: e.target.value })} className={selectCls}>
              <option value="">All bills</option>{d.options.billTypes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Visit type">
            <select value={filters.visitType} onChange={(e) => set({ visitType: e.target.value })} className={selectCls}>
              <option value="">All visits</option>{d.options.visitTypes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] text-[color:var(--ink-soft)]">
            {dmy(d.from)} – {dmy(d.to)} · {d.days} {d.days === 1 ? "day" : "days"}{comparing ? ` · compared with ${compareLabel}` : ""}{filtered ? " · filtered" : ""}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={reset} className="inline-flex h-[30px] items-center gap-1 rounded-full border border-[color:var(--line)] px-3 text-[12px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer"><RotateCcw size={12} /> Reset</button>
            <button onClick={() => setCustomising((c) => !c)} aria-expanded={customising} className={`inline-flex h-[30px] items-center gap-1 rounded-full border px-3 text-[12px] cursor-pointer ${customising ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
              <SlidersHorizontal size={12} /> Customise view
            </button>
          </div>
        </div>
        {customising && (
          <div className="rounded-[10px] bg-[color:var(--subtle)] p-3">
            <p className="text-[12px] text-[color:var(--ink-soft)]">Choose what this page shows. Your choice is kept for next time.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SECTIONS.map((s) => {
                const on = show(s.id);
                return (
                  <button key={s.id} aria-pressed={on} onClick={() => toggleSection(s.id)}
                    className={`inline-flex h-[30px] items-center gap-1 rounded-full border px-3 text-[12px] cursor-pointer ${on ? "border-[color:var(--brand)] bg-[color:var(--surface)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink-soft)]"}`}>
                    {on && <Check size={12} />} {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Hospital growth */}
      {show("growth") && (
        <section className={`${tw.surface.card} ${tw.radius.card} p-4 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]`}>
          <div>
            <h3 className="text-[13px] font-medium text-[color:var(--ink)]">Hospital growth rate</h3>
            <p className={`mt-2 text-[40px] font-semibold leading-[44px] ${d.growth.rate === null ? "text-[color:var(--ink-soft)]" : d.growth.rate >= 0 ? "text-[#00955c]" : "text-[#d4000a]"}`}>
              {d.growth.rate === null ? "—" : `${d.growth.rate > 0 ? "+" : ""}${d.growth.rate}%`}
            </p>
            <p className="text-[12px] text-[color:var(--ink-soft)]">
              {d.growth.rate === null ? `Nothing to compare with ${d.growth.basis} yet.` : `Average change across revenue, patients, appointments and new patients, against ${d.growth.basis}.`}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {d.growth.components.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-2 text-[13px]"><span className="text-[color:var(--ink)]">{c.label}</span><Change change={c.change} unit="pct" /></div>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[color:var(--ink)]">Month by month <span className="font-normal text-[12px] text-[color:var(--ink-soft)]">revenue collected, last 12 months</span></p>
            <div className="mt-3 flex h-[130px] items-end gap-[4px]" role="img" aria-label="Revenue collected each month">
              {d.growth.months.map((x) => (
                <div key={x.month} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${x.label}: ${inr(x.revenue)}${x.revenueGrowth !== null ? ` (${x.revenueGrowth > 0 ? "+" : ""}${x.revenueGrowth}% on the month before)` : ""}`}>
                  <div className="w-full rounded-t-[3px] bg-[color:var(--brand)]" style={{ height: x.revenue ? `${Math.max(4, (x.revenue / maxRevenue) * 100)}%` : "2px", opacity: x.revenue ? 1 : 0.2 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-[4px] text-[10px] text-[color:var(--ink-soft)]">{d.growth.months.map((x) => <span key={x.month} className="flex-1 min-w-0 text-center truncate">{x.label.slice(0, 3)}</span>)}</div>
            <p className="mt-3 text-[13px] font-medium text-[color:var(--ink)]">Patients seen <span className="font-normal text-[12px] text-[color:var(--ink-soft)]">and the change on the month before</span></p>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {d.growth.months.slice(-6).map((x) => (
                <div key={x.month} className="rounded-[8px] bg-[color:var(--subtle)] px-2 py-2">
                  <p className="text-[11px] text-[color:var(--ink-soft)]">{x.label}</p>
                  <p className="text-[15px] font-medium text-[color:var(--ink)]">{x.patients}</p>
                  <Change change={x.patientsGrowth} unit="pct" />
                </div>
              ))}
            </div>
            <div className="sr-only">{maxPatients}</div>
          </div>
        </section>
      )}

      {/* Key figures */}
      {GROUPS.filter((g) => show(g.id)).map((g) => (
        <section key={g.id}>
          <h3 className="mb-2 text-[13px] font-medium text-[color:var(--ink-soft)]">{g.title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{group(g.g).map((k) => <KpiCard key={k.key} k={k} comparing={comparing} />)}</div>
        </section>
      ))}

      {/* Trend */}
      {show("trend") && (
        <Card title="Patients and revenue" note={`by ${d.interval} · bars are patients seen, the line is revenue collected`}>
          {d.trend.length < 2 ? <p className="py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Pick a longer period to see a trend.</p> : <TrendChart series={d.trend.map((t) => ({ label: t.label, patients: t.patients, collected: t.collected }))} />}
          {comparing && d.trend.some((t) => t.prevCollected !== null) && (
            <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Revenue in the comparison period: {inrShort(d.trend.reduce((n, t) => n + (t.prevCollected ?? 0), 0))} · this period: {inrShort(d.trend.reduce((n, t) => n + t.collected, 0))}</p>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Retention */}
        {show("retention") && (
          <Card title="Patient retention">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-[34px] font-semibold leading-9 text-[color:var(--ink)]">{d.retention.rate === null ? "—" : `${d.retention.rate}%`}</p>
                <p className="text-[12px] text-[color:var(--ink-soft)]">{d.retention.rate === null ? "No patients in the period before to measure against." : `${d.retention.returned} of ${d.retention.previousPatients} patients from the period before came back`}</p>
              </div>
              <div>
                <p className="text-[22px] font-medium leading-7 text-[color:var(--ink)]">{d.retention.repeatRate === null ? "—" : `${d.retention.repeatRate}%`}</p>
                <p className="text-[12px] text-[color:var(--ink-soft)]">came on more than one day</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Bar label="New patients (not seen in the period before)" value={d.retention.newPatients} max={d.retention.newPatients + d.retention.returning} text={String(d.retention.newPatients)} color="#7c5cff" />
              <Bar label="Returning patients" value={d.retention.returning} max={d.retention.newPatients + d.retention.returning} text={String(d.retention.returning)} />
              {d.retention.visitFrequency.map((v) => <Bar key={v.label} label={v.label} value={v.patients} max={Math.max(1, ...d.retention.visitFrequency.map((x) => x.patients))} text={String(v.patients)} color="#ff9000" />)}
            </div>
          </Card>
        )}

        {/* Revenue mix */}
        {show("revenue") && (
          <Card title="Revenue by bill type" note={`${inr(d.revenueByType.reduce((n, r) => n + r.collected, 0))} collected`}>
            {d.revenueByType.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No paid bills in this period.</p> : (
              <div className="flex flex-col gap-3">{d.revenueByType.map((r) => <Bar key={r.type} label={`${r.type} · ${r.bills} ${r.bills === 1 ? "bill" : "bills"}`} value={r.collected} max={maxType} text={`${inr(r.collected)} · ${r.share}%`} />)}</div>
            )}
          </Card>
        )}
      </div>

      {/* Doctors */}
      {show("doctors") && (
        <Card title="Doctors" note="busiest first">
          {d.byDoctor.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No doctor activity in this period.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead><tr className="text-[12px] text-[color:var(--ink-soft)]"><th className="py-2 pr-3 font-normal">Doctor</th><th className="py-2 pr-3 font-normal">Patients</th><th className="py-2 pr-3 font-normal">Appointments</th><th className="py-2 pr-3 font-normal">Completed</th><th className="py-2 font-normal">Revenue</th></tr></thead>
                <tbody>{d.byDoctor.map((x) => (
                  <tr key={`${x.id}-${x.name}`} className="border-t border-[color:var(--line)]">
                    <td className="py-2 pr-3 font-medium text-[color:var(--ink)]">{x.name}</td><td className="py-2 pr-3">{x.patients}</td><td className="py-2 pr-3">{x.appointments}</td><td className="py-2 pr-3">{x.completed}</td><td className="py-2">{inr(x.collected)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Status */}
      {show("status") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Appointments by status">
            {d.appointmentsByStatus.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No appointments in this period.</p> : (
              <div className="flex flex-col gap-3">{d.appointmentsByStatus.map((s) => <Bar key={s.status} label={s.status} value={s.count} max={maxStatus} text={String(s.count)} color={s.status === "Cancelled" ? "#ff4d4f" : s.status === "Completed" ? "#12a150" : "var(--brand)"} />)}</div>
            )}
          </Card>
          <Card title="Follow-ups" note={d.followUps.completionRate === null ? "" : `${d.followUps.completionRate}% completed`}>
            {d.followUps.due === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No follow-ups fall in this period.</p> : (
              <div className="flex flex-col gap-3">
                <Bar label="Done" value={d.followUps.done} max={d.followUps.due} text={String(d.followUps.done)} color="#12a150" />
                <Bar label="Missed" value={d.followUps.missed} max={d.followUps.due} text={String(d.followUps.missed)} color="#ff4d4f" />
                <Bar label="Overdue (not yet done)" value={d.followUps.overdue} max={d.followUps.due} text={String(d.followUps.overdue)} color="#ff9000" />
                <Bar label="Still to come" value={d.followUps.pending - d.followUps.overdue} max={d.followUps.due} text={String(d.followUps.pending - d.followUps.overdue)} />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
