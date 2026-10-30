"use client";

import { useState } from "react";
import { useItem } from "@/lib/api/hooks";
import type { AiMonitorDTO } from "@/types/api";

const RANGES = [7, 30, 90] as const;
const dm = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const when = (ts: string) => new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

const Stat = ({ label, value, sub, bad }: { label: string; value: string | number; sub?: string; bad?: boolean }) => (
  <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
    <p className="text-[13px] text-[color:var(--ink-soft)]">{label}</p>
    <p className={`mt-1 font-mono text-[24px] font-bold leading-8 ${bad ? "text-[#d10024]" : ""}`}>{value}</p>
    {sub && <p className="text-[12px] text-[color:var(--ink-soft)]">{sub}</p>}
  </div>
);

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="mt-7">
    <h2 className="mb-2 text-[13px] font-semibold text-[color:var(--ink-soft)]">{title}{note && <span className="ml-2 font-normal">{note}</span>}</h2>
    {children}
  </section>
);

function Breakdown({ title, rows }: { title: string; rows: { name: string; notes: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.notes));
  return (
    <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
      <p className="mb-2 text-[13px] font-medium">{title}</p>
      {rows.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">None yet.</p> : rows.map((r) => (
        <div key={r.name} className="mb-[6px] flex items-center gap-3 text-[12px]">
          <span className="w-32 shrink-0 truncate text-[color:var(--ink-soft)]" title={r.name}>{r.name}</span>
          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${(r.notes / max) * 100}%` }} /></span>
          <span className="w-8 text-right font-mono">{r.notes}</span>
        </div>
      ))}
    </div>
  );
}

/** Daily use of the three AI features as stacked bars. */
function Activity({ series }: { series: AiMonitorDTO["series"] }) {
  const max = Math.max(4, ...series.map((s) => s.scribe + s.chat + s.whatsapp));
  const every = Math.ceil(series.length / 12);
  return (
    <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 pb-3 pt-4">
      <div className="flex h-[150px] items-end gap-[3px]" role="img" aria-label="Daily AI activity">
        {series.map((s) => {
          const total = s.scribe + s.chat + s.whatsapp;
          return (
            <div key={s.date} className="flex h-full flex-1 flex-col justify-end" title={`${dm(s.date)} — scribe ${s.scribe}, chat ${s.chat}, WhatsApp ${s.whatsapp}`}>
              {[["#7c5cff", s.scribe], ["var(--brand)", s.chat], ["#12a150", s.whatsapp]].map(([c, n]) => Number(n) > 0 && <div key={String(c)} style={{ height: `${(Number(n) / max) * 100}%`, background: String(c) }} />)}
              <span className="sr-only">{total}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-[color:var(--ink-soft)]">{series.map((s, i) => <span key={s.date} className="flex-1 overflow-visible whitespace-nowrap text-center">{i % every === 0 ? dm(s.date) : ""}</span>)}</div>
      <p className="mt-2 flex gap-4 text-[12px] text-[color:var(--ink-soft)]">
        {[["#7c5cff", "Scribe notes"], ["var(--brand)", "AI chat questions"], ["#12a150", "WhatsApp bot messages"]].map(([c, l]) => <span key={l} className="inline-flex items-center gap-[6px]"><span className="inline-block h-[9px] w-[9px] rounded-[2px]" style={{ background: c }} />{l}</span>)}
      </p>
    </div>
  );
}

/** Reports → AI monitor: how much the scribe, the AI chat and the WhatsApp bot are used, and how they are doing. */
export function AiMonitorView() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { item: a, error } = useItem<AiMonitorDTO>(`/analytics/ai?days=${days}`);
  const [last, setLast] = useState<AiMonitorDTO | null>(null);
  if (a && a !== last) setLast(a);
  const d = a ?? last;
  if (!d) return <p className="px-5 py-10 text-[14px] text-[color:var(--ink-soft)]">{error ? "The AI monitor couldn't be loaded." : "Loading…"}</p>;
  return (
    <div className="px-5 pb-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[color:var(--ink-soft)]">Since {dm(d.since)} · AI features across the hospital</p>
        <div role="radiogroup" aria-label="Period" className="flex rounded-[8px] bg-[color:var(--subtle-2)] p-[3px]">
          {RANGES.map((r) => (
            <button key={r} role="radio" aria-checked={days === r} onClick={() => setDays(r)}
              className={`cursor-pointer rounded-[6px] px-3 py-[4px] text-[13px] ${days === r ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{r} days</button>
          ))}
        </div>
      </div>

      <Section title="Activity"><Activity series={d.series} /></Section>

      <Section title="AI scribe" note="consultation notes written from the doctor's recording">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Notes" value={d.scribe.notes} /><Stat label="Recorded" value={`${d.scribe.minutes} min`} /><Stat label="Patients" value={d.scribe.patients} /><Stat label="Doctors using it" value={d.scribe.byDoctor.length} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3"><Breakdown title="By doctor" rows={d.scribe.byDoctor} /><Breakdown title="By language" rows={d.scribe.byLanguage} /><Breakdown title="By status" rows={d.scribe.byStatus} /></div>
        {d.scribe.recent.length > 0 && (
          <table className="mt-3 w-full border-collapse overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] text-[13px]">
            <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2">When</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Doctor</th><th className="px-4 py-2">Language</th><th className="px-4 py-2 text-right">Length</th><th className="px-4 py-2">Status</th></tr></thead>
            <tbody>{d.scribe.recent.map((n) => <tr key={n.id} className="border-t border-[color:var(--line)]"><td className="px-4 py-2 font-mono text-[12px]">{when(n.at)}</td><td className="px-4 py-2">{n.patient}</td><td className="px-4 py-2">{n.doctor}</td><td className="px-4 py-2">{n.language}</td><td className="px-4 py-2 text-right font-mono">{Math.round(n.seconds / 60)} min</td><td className="px-4 py-2">{n.status}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="AI chat" note="how often staff use the assistant (the questions themselves aren't shown)">
        <div className="grid grid-cols-4 gap-3"><Stat label="Questions" value={d.chat.questions} /><Stat label="Answers" value={d.chat.answers} /><Stat label="Conversations" value={d.chat.threads} /><Stat label="People asking" value={d.chat.users} /></div>
      </Section>

      <Section title="WhatsApp bot" note="messages to and from the bot (their text isn't shown)">
        <div className="grid grid-cols-4 gap-3"><Stat label="Received" value={d.whatsapp.received} /><Stat label="Sent" value={d.whatsapp.sent} /><Stat label="Failed" value={d.whatsapp.failed} bad={d.whatsapp.failed > 0} /><Stat label="People" value={d.whatsapp.people} /></div>
        {d.whatsapp.recent.length > 0 && (
          <ul className="mt-3 divide-y divide-[color:var(--line)] rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] text-[13px]">
            {d.whatsapp.recent.map((m) => <li key={m.id} className="flex items-center gap-3 px-4 py-2"><span className="w-[92px] shrink-0 font-mono text-[11px] text-[color:var(--ink-soft)]">{when(m.at)}</span><span className="w-12 shrink-0 text-[12px] text-[color:var(--ink-soft)]">{m.direction === "in" ? "In" : "Out"}</span><span className="min-w-0 flex-1 truncate text-[color:var(--ink-soft)]">{m.kind}</span><span className={`text-[12px] ${m.status === "failed" ? "text-[#c8001a]" : "text-[color:var(--ink-soft)]"}`}>{m.status}</span></li>)}
          </ul>
        )}
      </Section>
    </div>
  );
}
