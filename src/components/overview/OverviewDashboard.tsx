"use client";

/**
 * The admin home: a command dashboard — what needs you today, the week's numbers, footfall and collections, beds, doctors,
 * retention, and the live queues. Everything comes from one read (`/dashboard/overview`).
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BedDouble, Calendar, CalendarPlus, IndianRupee, UserPlus, Users, Footprints } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { tw } from "@/lib/design-system";
import type { OverviewDTO } from "@/types/api";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** ₹3.7L, ₹1.2Cr, ₹850 — the way an Indian hospital reads a big amount. */
function inrShort(n: number): string {
  const v = Math.abs(n);
  const f = (x: number, unit: string) => `₹${(Math.round(x * 10) / 10).toString().replace(/\.0$/, "")}${unit}`;
  if (v >= 1e7) return f(n / 1e7, "Cr");
  if (v >= 1e5) return f(n / 1e5, "L");
  if (v >= 1e4) return f(n / 1e3, "K");
  return inr(n);
}
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fullDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const compare = (value: number, previous: number): string => {
  if (!previous) return "no comparison yet";
  const d = Math.round(((value - previous) / previous) * 100);
  return `${d > 0 ? "▲" : d < 0 ? "▼" : "="} ${Math.abs(d)}% vs last week`;
};

const TONES: Record<string, string> = {
  green: "bg-[#e5f8ef] text-[#00794a] border-[#bfe9d3]",
  red: "bg-[#ffe9ec] text-[#c8001a] border-[#f6bcc4]",
  amber: "bg-[#fff4e0] text-[#a65f00] border-[#f6d9a4]",
  purple: "bg-[#f1e9ff] text-[#6a35c2] border-[#d9c6f7]",
  grey: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
};
const Chip = ({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) => (
  <span className={`rounded-full border px-[8px] py-[1px] text-[11px] font-medium ${TONES[tone]}`}>{children}</span>
);

const Card = ({ title, note, link, children, className = "" }: { title: string; note?: string; link?: { href: string; label: string; key?: string }; children: ReactNode; className?: string }) => (
  <section className={`${tw.surface.card} ${tw.radius.card} flex min-w-0 flex-col ${className}`}>
    <header className="flex items-center gap-2 border-b border-[color:var(--line)] px-[18px] py-[12px]">
      <h3 className="text-[14px] font-medium text-[color:var(--ink)]">{title}</h3>
      {note && <span className="text-[12px] text-[color:var(--ink-soft)]">{note}</span>}
      {link && (
        <Link href={link.href} className="ml-auto flex items-center gap-1 text-[12px] font-medium text-[color:var(--brand)] hover:underline">
          {link.label}{link.key && <kbd className="rounded border border-[color:var(--line)] px-[5px] text-[10px] font-normal text-[color:var(--ink-soft)]">{link.key}</kbd>}
        </Link>
      )}
    </header>
    <div className="flex-1 p-[18px]">{children}</div>
  </section>
);
const Empty = ({ children }: { children: ReactNode }) => <p className="flex h-full min-h-[90px] items-center justify-center text-center text-[13px] text-[color:var(--ink-soft)]">{children}</p>;

// ── Footfall & collections chart ─────────────────────────────────────────────

function niceMax(v: number, floor: number): number {
  const m = Math.max(v, floor);
  const mag = 10 ** Math.floor(Math.log10(m));
  return Math.ceil(m / mag) * mag;
}

function TrendChart({ trend }: { trend: OverviewDTO["trend"] }) {
  const W = 620, H = 230, L = 34, R = 56, T = 12, B = 28;
  const pMax = niceMax(Math.max(...trend.map(t => t.patients), 0), 4);
  const cMax = niceMax(Math.max(...trend.map(t => t.collected), 0), 4);
  const x = (i: number) => L + (trend.length === 1 ? 0 : (i * (W - L - R)) / (trend.length - 1));
  const y = (v: number, max: number) => T + (1 - v / max) * (H - T - B);
  const line = (key: "patients" | "collected", max: number) => trend.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(t[key], max).toFixed(1)}`).join(" ");
  const step = trend.length > 20 ? 4 : trend.length > 10 ? 2 : 1;
  const ticks = [0, 1, 2, 3, 4];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Footfall and collections trend">
      {ticks.map(t => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y((t / 4) * pMax, pMax)} y2={y((t / 4) * pMax, pMax)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={L - 8} y={y((t / 4) * pMax, pMax) + 4} textAnchor="end" fontSize="10" fill="var(--ink-soft)">{Math.round((t / 4) * pMax)}</text>
          <text x={W - R + 8} y={y((t / 4) * cMax, cMax) + 4} fontSize="10" fill="var(--ink-soft)">{inrShort((t / 4) * cMax)}</text>
        </g>
      ))}
      {trend.map((t, i) => (trend.length - 1 - i) % step === 0 && <text key={t.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-soft)">{dayLabel(t.date)}</text>)}
      <path d={line("patients", pMax)} fill="none" stroke="#6aa3c8" strokeWidth="2" strokeLinejoin="round" />
      <path d={line("collected", cMax)} fill="none" stroke="#00955c" strokeWidth="2" strokeLinejoin="round" />
      {trend.map((t, i) => (
        <g key={t.date}>
          {t.patients > 0 && <circle cx={x(i)} cy={y(t.patients, pMax)} r="3" fill="#6aa3c8"><title>{`${dayLabel(t.date)}: ${t.patients} patients`}</title></circle>}
          {t.collected > 0 && <circle cx={x(i)} cy={y(t.collected, cMax)} r="3" fill="#00955c"><title>{`${dayLabel(t.date)}: ${inr(t.collected)} collected`}</title></circle>}
        </g>
      ))}
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function OverviewDashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(14);
  const { item, error } = useItem<OverviewDTO>(`/dashboard/overview?days=${days}`);
  // Switching the range re-reads the page; keep showing the last data meanwhile so nothing flashes empty.
  const [last, setLast] = useState<OverviewDTO | null>(null);
  if (item && item !== last) setLast(item);
  const o = item ?? last;

  if (!o) {
    return <div className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>{error ? "The overview couldn't be loaded." : "Loading the overview…"}</div>;
  }
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (user?.name ?? "").replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, "").split(" ")[0] || "there";
  const a = o.attention;
  const totalPatients = o.trend.reduce((n, t) => n + t.patients, 0);
  const totalCollected = o.trend.reduce((n, t) => n + t.collected, 0);
  const modeMax = Math.max(...o.byMode.map(m => m.amount), 1);
  const loadMax = Math.max(...o.doctorLoad.map(d => d.total), 1);
  const pctOcc = o.kpis.beds.total ? Math.round((o.kpis.beds.occupied / o.kpis.beds.total) * 100) : 0;
  const r = o.retention;
  const rate = (v: number | null) => (v === null ? "–" : `${v}%`);

  return (
    <div className={`${tw.gutterX} flex flex-col gap-5 pb-[30px] pt-[16px]`}>
      {/* Greeting */}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-[color:var(--ink-soft)]">{fullDate(o.today)}</p>
          <span className="flex items-center gap-2 rounded-full border border-[color:var(--line)] px-3 py-[3px] text-[12px]">
            <span className={`h-[7px] w-[7px] rounded-full ${o.plan.active ? "bg-[#00955c]" : "bg-[#c8001a]"}`} />
            <b className="font-medium text-[color:var(--ink)]">{o.plan.name}</b>
            <span className="text-[color:var(--ink-soft)]">{o.plan.active ? "Active" : "Expired"}</span>
          </span>
        </div>
        <h1 className="text-[28px] font-medium leading-[34px] text-[color:var(--ink)]">{greeting}, <span className="text-[color:var(--brand)]">{first}</span></h1>
        <p className="mt-1 text-[14px] text-[color:var(--ink)]">
          <b className="font-medium">{o.summary.patientsToday}</b> patient{o.summary.patientsToday === 1 ? "" : "s"} so far, <b className="font-medium">{inr(o.summary.collectedToday)}</b> collected,{" "}
          {o.summary.opdWaiting ? `${o.summary.opdWaiting} waiting in the OPD queue` : "OPD queue is clear"}
          {o.summary.urgentLabs > 0 && <>, <b className="font-medium text-[#c8001a]">{o.summary.urgentLabs} urgent</b> lab order{o.summary.urgentLabs === 1 ? "" : "s"}</>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/patients/new", label: "Register", icon: UserPlus, key: "P", primary: true },
            { href: "/appointments/new", label: "Book", icon: CalendarPlus, key: "A" },
            { href: "/opd", label: "Walk-in", icon: Footprints, key: "O" },
            { href: "/ipd", label: "Admit", icon: BedDouble, key: "I" },
          ].map(b => (
            <Link key={b.label} href={b.href} className={`flex h-[34px] items-center gap-2 rounded-[8px] border px-3 text-[13px] font-medium transition-colors ${b.primary ? "border-transparent bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
              <b.icon size={14} strokeWidth={1.7} />{b.label}
              <kbd className={`rounded border px-[5px] text-[10px] font-normal ${b.primary ? "border-white/40 text-white/90" : "border-[color:var(--line)] text-[color:var(--ink-soft)]"}`}>{b.key}</kbd>
            </Link>
          ))}
        </div>
      </div>

      {/* Needs you today */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-medium text-[color:var(--ink-soft)]">Needs you today</h2>
          <Link href="/tasks" className="text-[12px] font-medium text-[color:var(--brand)] hover:underline">Open worklist →</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "Waiting in OPD", chip: a.opdWaiting ? <Chip tone="amber">Waiting</Chip> : <Chip tone="green">Clear</Chip>, value: String(a.opdWaiting), sub: a.opdWaiting ? `${a.opdWaiting} patient${a.opdWaiting === 1 ? "" : "s"} in the queue` : "no one waiting", href: "/opd", key: "O" },
            { title: "Urgent lab orders", chip: a.urgentLabs.urgent ? <Chip tone="red">Urgent</Chip> : <Chip tone="green">Clear</Chip>, value: String(a.urgentLabs.urgent), sub: `need a clinician's eyes · ${a.urgentLabs.pending} pending`, href: "/lab", key: "L" },
            { title: "Unpaid bills", chip: a.unpaid.bills ? <Chip tone="amber">Collect</Chip> : <Chip tone="green">Clear</Chip>, value: inrShort(a.unpaid.amount), sub: `${a.unpaid.bills} bill${a.unpaid.bills === 1 ? "" : "s"} outstanding`, href: "/billing", key: "B" },
            { title: "Claims to submit", chip: a.claims.count ? <Chip tone="purple">Stalled</Chip> : <Chip tone="green">Clear</Chip>, value: String(a.claims.count), sub: "insured bills with no claim raised", href: "/tpa" },
          ].map(c => (
            <div key={c.title} className={`${tw.surface.card} ${tw.radius.card} flex flex-col gap-1 p-[16px]`}>
              <div className="flex items-center justify-between gap-2"><h3 className="text-[13px] font-medium text-[color:var(--ink)]">{c.title}</h3>{c.chip}</div>
              <div className="flex items-end justify-between">
                <span className="text-[30px] font-medium leading-[38px] text-[color:var(--ink)]">{c.value}</span>
                <Link href={c.href} className="mb-1 flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--brand)]">Open{c.key && <kbd className="rounded border border-[color:var(--line)] px-[5px] text-[10px]">{c.key}</kbd>}</Link>
              </div>
              <p className="text-[12px] text-[color:var(--ink-soft)]">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The week */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Users, tint: "bg-[#e4f1f7] text-[#2f7fa8]", label: "Patients · week", value: String(o.kpis.patientsWeek.value), sub: compare(o.kpis.patientsWeek.value, o.kpis.patientsWeek.previous) },
          { icon: IndianRupee, tint: "bg-[#e5f8ef] text-[#00794a]", label: "Collected · week", value: inr(o.kpis.collectedWeek.value), sub: compare(o.kpis.collectedWeek.value, o.kpis.collectedWeek.previous) },
          { icon: Calendar, tint: "bg-[#e6eefc] text-[#3b63c4]", label: "Appointments", value: String(o.kpis.appointments.total), sub: `${o.kpis.appointments.left} left today` },
          { icon: BedDouble, tint: "bg-[#f1e9ff] text-[#6a35c2]", label: "Bed occupancy", value: `${pctOcc}%`, sub: `${o.kpis.beds.occupied} of ${o.kpis.beds.total} beds` },
        ].map(k => (
          <div key={k.label} className={`${tw.surface.card} ${tw.radius.card} flex flex-col gap-2 p-[16px]`}>
            <div className="flex items-center gap-2"><span className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] ${k.tint}`}><k.icon size={15} strokeWidth={1.7} /></span><span className="text-[13px] text-[color:var(--ink)]">{k.label}</span></div>
            <span className="text-[28px] font-medium leading-[34px] text-[color:var(--ink)]">{k.value}</span>
            <span className="text-[12px] text-[color:var(--ink-soft)]">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Footfall & collections */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section className={`${tw.surface.card} ${tw.radius.card} min-w-0`}>
          <header className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] px-[18px] py-[12px]">
            <h3 className="text-[14px] font-medium">Footfall &amp; collections</h3>
            <span className="text-[12px] text-[color:var(--ink-soft)]">last {days} days</span>
            <div className="ml-auto flex rounded-[8px] bg-[color:var(--subtle)] p-[3px]">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDays(d)} className={`rounded-[6px] px-[10px] py-[2px] text-[12px] ${days === d ? "bg-white font-medium text-[color:var(--ink)] shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{d}d</button>
              ))}
            </div>
          </header>
          <div className="p-[18px]">
            <div className="mb-2 flex flex-wrap gap-6 text-[13px]">
              <span className="flex items-center gap-2"><i className="h-[8px] w-[8px] rounded-full bg-[#6aa3c8]" />Patients <b className="text-[16px] font-medium">{totalPatients}</b></span>
              <span className="flex items-center gap-2"><i className="h-[8px] w-[8px] rounded-full bg-[#00955c]" />Collected <b className="text-[16px] font-medium">{inr(totalCollected)}</b></span>
            </div>
            <TrendChart trend={o.trend} />
          </div>
        </section>
        <Card title="Collections by mode" note="last 30 days" link={{ href: "/billing", label: "Cash desk" }}>
          {o.byMode.length === 0 ? <Empty>No payments recorded yet.</Empty> : (
            <ul className="flex flex-col gap-3">
              {o.byMode.map(m => (
                <li key={m.mode}>
                  <div className="flex justify-between text-[13px]"><span>{m.mode}</span><span className="font-medium">{inr(m.amount)} <span className="font-normal text-[color:var(--ink-soft)]">· {m.count}</span></span></div>
                  <div className="mt-1 h-[6px] rounded-full bg-[color:var(--subtle-2)]"><div className="h-full rounded-full bg-[#00955c]" style={{ width: `${(m.amount / modeMax) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Today in the hospital */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Appointments today" note={`${o.kpis.appointments.total} booked`} link={{ href: "/appointments", label: "Open", key: "A" }}>
          {o.appointmentsToday.length === 0 ? <Empty>No appointments scheduled for today.</Empty> : (
            <ul className="flex flex-col gap-2">
              {o.appointmentsToday.slice(0, 6).map(ap => (
                <li key={ap.id} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[68px] shrink-0 font-mono text-[12px] text-[color:var(--ink-soft)]">{ap.time}</span>
                  <span className="min-w-0 flex-1 truncate">{ap.patient}<span className="block truncate text-[11px] text-[color:var(--ink-soft)]">{ap.doctor}</span></span>
                  <Chip tone={ap.status === "Completed" ? "green" : "grey"}>{ap.status}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Beds by class" note={`${o.kpis.beds.occupied} / ${o.kpis.beds.total}`} link={{ href: "/beds", label: "Open", key: "B" }}>
          {o.bedsByClass.length === 0 ? <Empty>No beds set up yet.</Empty> : (
            <>
              <ul className="flex flex-col gap-3">
                {o.bedsByClass.map(g => (
                  <li key={g.name}>
                    <div className="flex justify-between text-[13px]"><span>{g.name}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{g.occupied}/{g.total} · {g.total ? Math.round((g.occupied / g.total) * 100) : 0}%</span></div>
                    <div className="mt-1 h-[6px] rounded-full bg-[color:var(--subtle-2)]"><div className="h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${g.total ? (g.occupied / g.total) * 100 : 0}%` }} /></div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-[color:var(--line)] pt-2 text-[12px] text-[color:var(--ink-soft)]"><span>↑ {o.admittedToday} admitted today</span><span>↓ {o.dischargedToday} discharged</span></div>
            </>
          )}
        </Card>
        <Card title="Doctor load" note="today" link={{ href: "/opd", label: "Queue", key: "O" }}>
          {o.doctorLoad.length === 0 ? <Empty>No consultations scheduled today.</Empty> : (
            <ul className="flex flex-col gap-3">
              {o.doctorLoad.slice(0, 6).map(d => (
                <li key={d.doctor}>
                  <div className="flex justify-between text-[13px]"><span className="truncate">{d.doctor}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{d.seen}/{d.total} seen</span></div>
                  <div className="mt-1 h-[6px] rounded-full bg-[color:var(--subtle-2)]"><div className="h-full rounded-full bg-[#3b63c4]" style={{ width: `${(d.total / loadMax) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Retention */}
      <Card title="Patient retention" note="last 30 days" link={{ href: "/followups", label: "Open" }}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { l: "No-show rate", v: rate(r.noShowRate), tone: r.noShowRate !== null && r.noShowRate > 20 ? "text-[#c8001a]" : "" },
            { l: "Follow-ups kept", v: rate(r.followUpsKept), tone: r.followUpsKept !== null && r.followUpsKept >= 70 ? "text-[#00794a]" : "" },
            { l: "Came back in 90 days", v: rate(r.cameBack90), tone: r.cameBack90 !== null && r.cameBack90 >= 50 ? "text-[#00794a]" : "" },
            { l: "Returning share", v: rate(r.returningShare), tone: "" },
          ].map(s => (
            <div key={s.l}><p className="text-[12px] text-[color:var(--ink-soft)]">{s.l}</p><p className={`font-mono text-[22px] font-medium ${s.tone}`}>{s.v}</p></div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="grey">{r.missed} Missed</Chip>
          <Chip tone={r.followUpsDue ? "amber" : "grey"}>{r.followUpsDue} Follow-ups due</Chip>
          <Chip tone={r.atRisk ? "red" : "grey"}>{r.atRisk} At risk</Chip>
          <Chip tone="grey">{r.lapsed} Lapsed</Chip>
        </div>
      </Card>

      {/* Attention & schedule */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Needs your attention" note={`${o.alerts.length} item${o.alerts.length === 1 ? "" : "s"}`}>
          {o.alerts.length === 0 ? <Empty>Nothing needs you right now.</Empty> : (
            <ul className="flex flex-col gap-3">
              {o.alerts.map(al => (
                <li key={al.title} className={`rounded-[10px] border px-4 py-3 ${al.tone === "red" ? "border-[#f6bcc4] bg-[#fff1f3]" : al.tone === "amber" ? "border-[#f6d9a4] bg-[#fffaf0]" : "border-[color:var(--line)] bg-[color:var(--subtle)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-[14px] font-medium"><i className={`h-[8px] w-[8px] rounded-full ${al.tone === "red" ? "bg-[#d9001b]" : al.tone === "amber" ? "bg-[#f2a100]" : "bg-[#6b6b73]"}`} />{al.title}</p>
                    <Link href={al.href} className="shrink-0 text-[12px] text-[color:var(--ink)] hover:underline">{al.action} →</Link>
                  </div>
                  <p className="mt-1 pl-4 text-[12px] text-[color:var(--ink-soft)]">{al.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Today's schedule" link={{ href: "/appointments", label: "View all" }}>
          {o.appointmentsToday.length === 0 && o.theatre.length === 0 ? <Empty>No appointments scheduled for today.</Empty> : (
            <ul className="flex flex-col gap-2">
              {[...o.appointmentsToday.map(x => ({ id: `a${x.id}`, time: x.time, text: `${x.patient} · ${x.doctor}`, kind: "Appointment" })), ...o.theatre.map(x => ({ id: `o${x.id}`, time: x.time, text: `${x.procedure} · ${x.patient}`, kind: "Theatre" }))].slice(0, 8).map(x => (
                <li key={x.id} className="flex items-center gap-3 text-[13px]"><span className="w-[68px] shrink-0 font-mono text-[12px] text-[color:var(--ink-soft)]">{x.time}</span><span className="min-w-0 flex-1 truncate">{x.text}</span><Chip tone={x.kind === "Theatre" ? "purple" : "grey"}>{x.kind}</Chip></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Queues */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="OPD queue" note={`${o.attention.opdWaiting} waiting`} link={{ href: "/opd", label: "Open", key: "O" }}>
          {o.opdQueue.length === 0 ? <Empty>No patients waiting in the OPD queue.</Empty> : (
            <ul className="flex flex-col gap-2">
              {o.opdQueue.map(q => (
                <li key={q.id} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[56px] shrink-0 font-medium text-[color:var(--brand)]">{q.token}</span>
                  <span className="min-w-0 flex-1 truncate">{q.patient}<span className="block truncate text-[11px] text-[color:var(--ink-soft)]">{q.doctor}</span></span>
                  {q.priority !== "Normal" && <Chip tone={q.priority === "Emergency" ? "red" : "amber"}>{q.priority}</Chip>}
                  <span className="w-[56px] text-right text-[12px] text-[color:var(--ink-soft)]">{q.wait}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Operating theatre" note={`${o.theatre.length} case${o.theatre.length === 1 ? "" : "s"}`} link={{ href: "/ot", label: "Open" }}>
          {o.theatre.length === 0 ? <Empty>No theatre cases scheduled for today.</Empty> : (
            <ul className="flex flex-col gap-2">
              {o.theatre.map(t => (
                <li key={t.id} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[68px] shrink-0 font-mono text-[12px] text-[color:var(--ink-soft)]">{t.time}</span>
                  <span className="min-w-0 flex-1 truncate">{t.procedure}<span className="block truncate text-[11px] text-[color:var(--ink-soft)]">{t.patient} · {t.room} · {t.surgeon}</span></span>
                  <Chip tone={t.status === "Completed" ? "green" : t.status === "In Progress" ? "amber" : "grey"}>{t.status}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

