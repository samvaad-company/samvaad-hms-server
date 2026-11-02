"use client";

/**
 * Runs the guided tours. A tour dims the screen, rings the thing a step points at, and shows a card that says what to do. It works across
 * screens (a step can send you to another page), waits for what it points at to appear, and lets you click the real thing or press Next
 * and have it done for you. Where a tour is up to survives a reload; finishing one records it and offers the next lesson.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles, Sparkle, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useItem } from "@/lib/api/hooks";
import type { TrainingMineDTO } from "@/types/api";
import { lessonById, recommendedFor, type LessonMeta } from "@/types/training";
import { TOURS, type Step } from "@/lib/training/tours";
import { findTarget, openDialog, unfoldSidebar } from "@/lib/training/target";
import { LessonIcon } from "./LessonIcon";

const STORE = "samvaad.tour";
const CARD_W = 352;
const PAD = 6;

interface TourApi { start: (lessonId: string) => void; stop: () => void; activeLesson: string | null; progress: TrainingMineDTO | null; recommended: LessonMeta[]; next: LessonMeta | null }
const Ctx = createContext<TourApi | null>(null);
export const useTour = (): TourApi => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTour must be used inside <TourProvider>");
  return c;
};

const HINTS = { click: "Click the highlighted item to continue - or press Next.", try: "Try it here, then press Next." } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readSaved = (): { lessonId: string; index: number } | null => { try { const v = JSON.parse(sessionStorage.getItem(STORE) ?? "null"); return v && typeof v.lessonId === "string" ? v : null; } catch { return null; } };

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, can } = useAuth();
  const { item: progress } = useItem<TrainingMineDTO>(user ? "/training" : null);
  const [active, setActive] = useState<{ lessonId: string; index: number } | null>(null);
  const [finished, setFinished] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const [cardH, setCardH] = useState(220);
  const targetRef = useRef<HTMLElement | null>(null);
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const moving = useRef(false);
  const dialogAtStart = useRef(false);

  // Pick up a tour that was running before a reload.
  useEffect(() => {
    // After the first paint, so the server and client agree on what to draw.
    const t = setTimeout(() => { const s = readSaved(); if (s && TOURS[s.lessonId]) setActive(s); }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { try { if (active) sessionStorage.setItem(STORE, JSON.stringify(active)); else sessionStorage.removeItem(STORE); } catch { /* the tour still runs */ } }, [active]);

  const steps: Step[] = active ? TOURS[active.lessonId] ?? [] : [];
  const step = active ? steps[active.index] : undefined;
  const lesson = active ? lessonById(active.lessonId) : undefined;

  const recommended = useMemo(() => (user ? recommendedFor(user.role).filter((l) => !l.needs || can(l.needs.resource, l.needs.action ?? "read")) : []), [user, can]);
  const doneIds = useMemo(() => new Set((progress?.lessons ?? []).filter((l) => l.status === "Completed").map((l) => l.lessonId)), [progress]);
  const nextLesson = (excluding?: string) => recommended.find((l) => !doneIds.has(l.id) && l.id !== excluding && TOURS[l.id]) ?? null;

  const post = useCallback((lessonId: string, event: string, stepNo?: number) => { void api.post("/training/progress", { lessonId, event, ...(stepNo !== undefined && { step: stepNo }) }).catch(() => undefined); }, []);

  const closeOpenedDialog = () => { if (!dialogAtStart.current && openDialog()) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); };

  const stop = useCallback(() => {
    if (active) post(active.lessonId, "skip", active.index + 1);
    closeOpenedDialog();
    setActive(null); setRect(null); targetRef.current = null;
  }, [active, post]);

  const start = useCallback((lessonId: string) => {
    if (!TOURS[lessonId]) return;
    unfoldSidebar();
    dialogAtStart.current = !!openDialog();
    setFinished(null); setActive({ lessonId, index: 0 }); post(lessonId, "start");
  }, [post]);

  const finish = useCallback(() => {
    if (!active) return;
    post(active.lessonId, "complete", steps.length);
    closeOpenedDialog();
    setFinished(active.lessonId); setActive(null); setRect(null); targetRef.current = null;
  }, [active, post, steps.length]);

  const go = useCallback((i: number) => {
    if (!active) return;
    if (i >= steps.length) { finish(); return; }
    setMissing(false); setRect(null); targetRef.current = null;
    setActive({ lessonId: active.lessonId, index: Math.max(0, i) });
  }, [active, steps.length, finish]);

  const next = useCallback(async () => {
    if (!active || !step || moving.current) return;
    moving.current = true;
    try {
      // "Press Next and we'll do it for you": a click step is clicked on the person's behalf.
      if (step.hint === "click" && targetRef.current?.isConnected) { targetRef.current.click(); await sleep(250); }
      go(active.index + 1);
    } finally { moving.current = false; }
  }, [active, step, go]);

  // Take the person to the step's screen, then wait for what it points at to appear.
  useEffect(() => {
    if (!active || !step) return;
    if (step.route && pathname !== step.route && !pathname.startsWith(`${step.route}/`)) router.push(step.route);
    if (!step.target) { targetRef.current = null; return; }
    let alive = true, scrolled = false;
    const started = Date.now();
    const tick = () => {
      if (!alive) return;
      const el = findTarget(step.target!);
      if (el) {
        if (el !== targetRef.current) { targetRef.current = el; scrolled = false; }
        if (!scrolled) { el.scrollIntoView({ block: "center", inline: "nearest" }); scrolled = true; }
        const r = el.getBoundingClientRect();
        setMissing(false);
        setRect((prev) => (prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height ? prev : r));
      } else if (Date.now() - started > 6000) { setMissing(true); setRect(null); targetRef.current = null; }
    };
    tick();
    const id = setInterval(tick, 120);
    return () => { alive = false; clearInterval(id); };
  }, [active, step, pathname, router]);

  // A click-step moves on when the real thing is clicked.
  useEffect(() => {
    const el = targetRef.current;
    if (!active || !step || step.hint !== "click" || !el) return;
    const onClick = () => { if (moving.current) return; moving.current = true; setTimeout(() => { moving.current = false; go(active.index + 1); }, 300); };
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  }, [active, step, go, rect]);

  // The card's height, kept up to date as its text changes, so it can be placed to fit.
  useEffect(() => {
    if (!cardEl) return;
    const ro = new ResizeObserver(() => setCardH(cardEl.offsetHeight));
    ro.observe(cardEl);
    return () => ro.disconnect();
  }, [cardEl]);
  useEffect(() => { cardEl?.querySelector<HTMLElement>("[data-tour-next]")?.focus({ preventScroll: true }); }, [cardEl, active?.index, active?.lessonId]);

  // Where the card goes: beside what it points at if there's room, else in the corner; in the middle when it points at nothing.
  const place = (): { left: number; top: number } => {
    const vw = window.innerWidth, vh = window.innerHeight, m = 14;
    if (!rect || !step?.target || missing) return { left: (vw - CARD_W) / 2, top: Math.max(m, (vh - cardH) / 2) };
    const clampY = (y: number) => Math.min(Math.max(m, y), vh - cardH - m);
    const clampX = (x: number) => Math.min(Math.max(m, x), vw - CARD_W - m);
    const right = rect.right + PAD + 16, left = rect.left - PAD - 16 - CARD_W, below = rect.bottom + PAD + 14, above = rect.top - PAD - 14 - cardH;
    if (right + CARD_W <= vw - m) return { left: right, top: clampY(rect.top) };
    if (left >= m) return { left, top: clampY(rect.top) };
    if (below + cardH <= vh - m) return { left: clampX(rect.left), top: below };
    if (above >= m) return { left: clampX(rect.left), top: above };
    return { left: vw - CARD_W - 24, top: vh - cardH - 24 };
  };

  const api_: TourApi = useMemo(() => ({ start, stop, activeLesson: active?.lessonId ?? null, progress: progress ?? null, recommended, next: nextLesson() }), [start, stop, active, progress, recommended, doneIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = finished ? lessonById(finished) : undefined;
  const upNext = finished ? nextLesson(finished) : null;
  const left = recommended.filter((l) => !doneIds.has(l.id) && l.id !== finished).length;
  const pos = active && step ? place() : null;
  const hasHole = !!rect && !missing;

  return (
    <Ctx.Provider value={api_}>
      {children}
      {active && step && lesson && pos && (
        <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "none" }}>
          {hasHole && rect ? (
            <>
              {[
                { left: 0, top: 0, width: "100vw", height: Math.max(0, rect.top - PAD) },
                { left: 0, top: rect.bottom + PAD, width: "100vw", height: `calc(100vh - ${rect.bottom + PAD}px)` },
                { left: 0, top: rect.top - PAD, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 },
                { left: rect.right + PAD, top: rect.top - PAD, width: `calc(100vw - ${rect.right + PAD}px)`, height: rect.height + PAD * 2 },
              ].map((b, i) => <div key={i} className="absolute bg-black/55" style={{ ...b, pointerEvents: "auto" }} />)}
              <div data-tour-ring className="absolute rounded-[12px] border-2 border-[color:var(--brand)]" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 4px color-mix(in srgb, var(--brand) 28%, transparent)" }} />
            </>
          ) : <div className="absolute inset-0 bg-black/55" style={{ pointerEvents: "auto" }} />}

          <div ref={setCardEl} role="dialog" aria-label={`${lesson.title}: step ${active.index + 1} of ${steps.length}`} data-tour-card data-tour-targeted={step.target ? "true" : "false"}
            className="absolute rounded-[16px] border border-[color:var(--line)] bg-[color:var(--surface)] p-[18px] shadow-2xl" style={{ left: pos.left, top: pos.top, width: CARD_W, pointerEvents: "auto" }}>
            <div className="mb-3 flex items-center gap-2 text-[12px] text-[color:var(--ink-soft)]">
              <LessonIcon name={lesson.icon} size={14} /><span className="truncate">{lesson.title}</span>
              <span className="ml-auto font-mono">{active.index + 1} of {steps.length}</span>
              <button aria-label="Close tour" onClick={stop} className="cursor-pointer rounded-full p-1 hover:bg-[color:var(--subtle)]"><X size={14} /></button>
            </div>
            <h2 className="text-[17px] font-semibold leading-6">{step.title}</h2>
            <p className="mt-1 text-[14px] leading-5 text-[color:var(--ink-soft)]">{step.body}</p>
            {missing && <p data-tour-missing className="mt-2 rounded-[8px] bg-[#fff6e8] px-3 py-2 text-[12px] text-[#8a5300]">We couldn&apos;t find this on the screen — it may not be available to your role. Press Next to carry on.</p>}
            {step.hint && !missing && (
              <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-[color:var(--brand-soft)] px-3 py-2 text-[12.5px] leading-[18px] text-[color:var(--ink)]"><Sparkle size={14} className="mt-[2px] shrink-0 text-[color:var(--brand)]" />{HINTS[step.hint]}</p>
            )}
            {step.shortcut && <p className="mt-3 flex items-center gap-2 text-[12px] text-[color:var(--ink-soft)]">Shortcut <kbd className="rounded-[4px] bg-[color:var(--subtle-2)] px-[6px] py-[1px] font-mono">{step.shortcut}</kbd></p>}
            <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><div className="h-full rounded-full bg-[color:var(--brand)] transition-all" style={{ width: `${((active.index + 1) / steps.length) * 100}%` }} /></div>
            <div className="mt-3 flex items-center">
              <button onClick={stop} className="cursor-pointer text-[13px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">Skip tour</button>
              <div className="ml-auto flex items-center gap-2">
                {active.index > 0 && <button aria-label="Back" onClick={() => go(active.index - 1)} className="cursor-pointer rounded-[8px] border border-[color:var(--line)] p-[7px] hover:bg-[color:var(--subtle)]"><ArrowLeft size={14} /></button>}
                <button data-tour-next onClick={() => void next()} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-4 py-[7px] text-[13px] font-semibold text-white">
                  {active.index === steps.length - 1 ? <>Finish <Check size={14} /></> : <>Next <ArrowRight size={14} /></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
          <div role="dialog" aria-label="Lesson finished" data-tour-card className="w-[380px] max-w-full rounded-[18px] bg-[color:var(--surface)] p-6 text-center shadow-2xl">
            <Sparkles size={36} className="mx-auto text-[color:var(--brand)]" />
            <h2 className="mt-3 text-[20px] font-semibold">Nice work!</h2>
            <p className="mt-1 text-[14px] text-[color:var(--ink-soft)]">You&apos;ve finished {done.title}. {left > 0 ? `${left} recommended ${left === 1 ? "lesson" : "lessons"} to go.` : "That's every lesson recommended for your role."}</p>
            {upNext && (
              <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--faint)] px-3 py-3 text-left">
                <LessonIcon name={upNext.icon} size={18} />
                <div className="min-w-0 flex-1"><p className="text-[11px] text-[color:var(--ink-soft)]">Up next</p><p className="truncate text-[14px] font-medium">{upNext.title}</p></div>
                <span className="text-[12px] text-[color:var(--ink-soft)]">{upNext.minutes} min</span>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setFinished(null)} className="flex-1 cursor-pointer rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] py-[9px] text-[14px] font-medium">Done for now</button>
              {upNext && <button onClick={() => start(upNext.id)} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[color:var(--brand)] py-[9px] text-[14px] font-semibold text-white">Start next lesson <ArrowRight size={14} /></button>}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
