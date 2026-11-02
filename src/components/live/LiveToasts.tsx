"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CalendarPlus, X } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate, todayIso } from "@/lib/dates";
import { useAppDispatch, useAppSelector } from "@/store";
import { notificationDismissed, type LiveNotification } from "@/store/liveSlice";

/** How long a notification stays before it goes by itself. */
const SHOW_MS = 10_000;

function Toast({ n }: { n: LiveNotification }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(notificationDismissed(n.id)), SHOW_MS);
    return () => clearTimeout(t);
  }, [n.id, dispatch]);
  const day = n.date === todayIso() ? "Today" : formatDate(n.date);
  return (
    <div role="status" className={`${tw.surface.card} ${tw.radius.card} pointer-events-auto flex items-start gap-3 border-l-[3px] border-l-[color:var(--brand)] p-[12px] shadow-lg`}>
      <span className="mt-[1px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[color:var(--brand-soft)] text-[color:var(--brand)]"><CalendarPlus size={16} strokeWidth={1.8} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[color:var(--ink)]">New appointment</p>
        <p className="truncate text-[13px] text-[color:var(--ink)]">{n.patient}{n.doctor && <span className="text-[color:var(--ink-soft)]"> · {n.doctor}</span>}</p>
        <p className="text-[12px] text-[color:var(--ink-soft)]">{day}, {n.time}{n.via && ` · ${n.via}`}</p>
        <Link href="/appointments" onClick={() => dispatch(notificationDismissed(n.id))} className="mt-1 inline-block text-[12px] font-medium text-[color:var(--brand)] hover:underline">View appointments →</Link>
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => dispatch(notificationDismissed(n.id))} className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"><X size={14} /></button>
    </div>
  );
}

/** The pop-ups announcing new appointments (see store/liveSlice and LiveAppointmentsListener). Sits under the top bar, on every screen. */
export function LiveToasts() {
  const notifications = useAppSelector((s) => s.live.notifications);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-5 top-[64px] z-[80] flex w-[340px] max-w-[calc(100vw-40px)] flex-col gap-2">
      {notifications.map((n) => <Toast key={n.id} n={n} />)}
    </div>
  );
}
