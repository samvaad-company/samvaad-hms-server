"use client";

/** Training & tours: lessons for every screen, picked for your role, and (for managers) how the team is getting on. */
import { useMemo, useState } from "react";
import { GraduationCap, Play, RotateCcw, Search, Sparkles } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api/client";
import { LESSONS, isRecommended, type LessonMeta } from "@/types/training";
import { TOURS } from "@/lib/training/tours";
import { useTour } from "@/components/training/TourProvider";
import { LessonCard } from "@/components/training/LessonCard";
import { TeamProgress } from "@/components/training/TeamProgress";

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${pct}% done`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--subtle-2)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform="rotate(-90 32 32)" />
      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">{pct}%</text>
    </svg>
  );
}

export default function TrainingPage() {
  const { user, can, loading } = useAuth();
  const tour = useTour();
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const role = user?.role ?? "";
  const usable = (l: LessonMeta) => !!TOURS[l.id] && (!l.needs || can(l.needs.resource, l.needs.action ?? "read"));
  const byId = useMemo(() => new Map((tour.progress?.lessons ?? []).map((p) => [p.lessonId, p] as const)), [tour.progress]);
  const needle = q.trim().toLowerCase();
  const match = (l: LessonMeta) => !needle || `${l.title} ${l.summary} ${l.group}`.toLowerCase().includes(needle);
  const recommended = LESSONS.filter((l) => isRecommended(l, role) && usable(l));
  const others = LESSONS.filter((l) => !isRecommended(l, role) && usable(l));
  const done = recommended.filter((l) => byId.get(l.id)?.status === "Completed").length;
  const pct = recommended.length ? Math.round((done / recommended.length) * 100) : 0;
  const next = recommended.find((l) => byId.get(l.id)?.status !== "Completed") ?? null;
  const startOver = async () => { setBusy(true); try { await api.post("/training/reset"); } finally { setBusy(false); } };
  if (loading) return null;

  const grid = (list: LessonMeta[]) => (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
      {list.map((l) => <LessonCard key={l.id} lesson={l} progress={byId.get(l.id)} onStart={() => tour.start(l.id)} />)}
    </div>
  );
  const rec = recommended.filter(match), more = others.filter(match);
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <GraduationCap size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Training &amp; tours</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">Hands-on lessons for every screen - pause, skip or replay any time</span>
        </div>
        <div className="flex border-b border-[color:var(--line)] px-5" role="tablist">
          {([["mine", "My lessons"], ...(can("staff", "write") ? [["team", "Team progress"]] : [])] as [typeof tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px cursor-pointer border-b-2 px-1 py-[12px] pr-5 text-[14px] ${tab === id ? "border-[color:var(--ink)] font-medium" : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>{label}</button>
          ))}
        </div>

        {tab === "team" ? <TeamProgress /> : (
          <div className="p-5">
            <section className="flex flex-wrap items-center gap-5 rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-5">
              <Ring pct={pct} />
              <div className="min-w-[220px] flex-1">
                <h2 className="text-[18px] font-semibold">{done === 0 ? "Let's get you started" : pct >= 100 ? "You're all caught up" : "Keep going - you're doing great"}</h2>
                <p className="text-[14px] text-[color:var(--ink-soft)]">{done} of {recommended.length} recommended lessons done</p>
              </div>
              {next && <button onClick={() => tour.start(next.id)} className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-[color:var(--brand)] px-4 py-[9px] text-[14px] font-semibold text-white"><Play size={14} />{done === 0 ? "Start" : "Continue"}: {next.title}</button>}
              {tour.progress && tour.progress.lessons.length > 0 && <button onClick={() => void startOver()} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-[9px] text-[14px] font-medium disabled:opacity-50"><RotateCcw size={14} />Start over</button>}
            </section>

            <label className="relative mt-5 block w-[320px] max-w-full">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons" aria-label="Search lessons" className="w-full rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] py-[8px] pl-8 pr-3 text-[14px] outline-none focus:border-[color:var(--brand)]" />
            </label>

            <h2 className="mb-3 mt-6 flex items-center gap-2 text-[13px] font-semibold text-[color:var(--ink-soft)]"><Sparkles size={14} className="text-[color:var(--brand)]" />Recommended for your role</h2>
            {rec.length ? grid(rec) : <p className="text-[13px] text-[color:var(--ink-soft)]">{needle ? "No recommended lesson matches that." : "Nothing is recommended for your role yet."}</p>}
            {more.length > 0 && (<><h2 className="mb-3 mt-8 text-[13px] font-semibold text-[color:var(--ink-soft)]">More lessons you can try</h2>{grid(more)}</>)}
          </div>
        )}
      </div>
    </div>
  );
}
