"use client";

import { Play, RotateCcw, Check } from "lucide-react";
import type { LessonMeta } from "@/types/training";
import type { TrainingProgressDTO } from "@/types/api";
import { LessonIcon } from "./LessonIcon";

/** One lesson: what it teaches, whether you've done it, and a button to start, continue or replay. */
export function LessonCard({ lesson, progress, onStart, unavailable }: { lesson: LessonMeta; progress?: TrainingProgressDTO; onStart: () => void; unavailable?: boolean }) {
  const done = progress?.status === "Completed";
  const started = progress?.status === "In progress";
  return (
    <article className={`flex flex-col rounded-[14px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 transition-shadow hover:shadow-md ${unavailable ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[color:var(--subtle)]"><LessonIcon name={lesson.icon} size={19} /></span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-5">{lesson.title}</h3>
          <p className="mt-1 text-[13px] leading-[18px] text-[color:var(--ink-soft)]">{lesson.summary}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 pt-4 text-[12px]">
        {done ? <span className="inline-flex items-center gap-1 rounded-full border border-[#9fe3c6] bg-[#e9fbf2] px-[10px] py-[2px] font-medium text-[#0b7a47]"><Check size={12} />Done</span>
          : <span className={`rounded-full border px-[10px] py-[2px] ${started ? "border-[#f1cf9b] bg-[#fff6e8] text-[#8a5300]" : "border-[color:var(--line)] bg-[color:var(--subtle)] text-[color:var(--ink-soft)]"}`}>{started ? "In progress" : "Not started"}</span>}
        <span className="text-[color:var(--ink-soft)]">{lesson.minutes} min</span>
        <button onClick={onStart} disabled={unavailable} aria-label={`${done ? "Replay" : started ? "Continue" : "Start"} ${lesson.title}`} className="ml-auto inline-flex cursor-pointer items-center gap-[6px] text-[13px] font-semibold hover:text-[color:var(--brand)] disabled:cursor-not-allowed">
          {done ? <><RotateCcw size={13} />Replay</> : <><Play size={13} />{started ? "Continue" : "Start"}</>}
        </button>
      </div>
    </article>
  );
}
