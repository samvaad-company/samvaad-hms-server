"use client";

/** The bell in the top bar: unread count, and the person's own notifications (e.g. a pre-auth form waiting for their signature). */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { NotificationListDTO } from "@/types/preauth";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const { item, reload } = useItem<NotificationListDTO>(user?.hospitalId ? "/notifications" : null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Check for new ones every minute, and whenever the tab is looked at again.
  useEffect(() => {
    if (!user?.hospitalId) return;
    const t = setInterval(reload, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.hospitalId, reload]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!user?.hospitalId) return <Bell size={18} strokeWidth={1.5} className="text-[color:var(--ink)]" />;
  const unread = item?.unread ?? 0;

  async function go(id: number, link: string) {
    setOpen(false);
    await api.post("/notifications", { ids: [id] }).catch(() => undefined);
    reload();
    if (link) router.push(link);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); reload(); }} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications" className="relative flex cursor-pointer items-center text-[color:var(--ink)] hover:text-[color:var(--brand)]">
        <Bell size={18} strokeWidth={1.5} />
        {unread > 0 && <span className="absolute -right-[6px] -top-[6px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#e5484d] px-[3px] text-[10px] font-semibold leading-none text-white" data-testid="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="fixed left-2 right-2 top-[64px] z-50 overflow-hidden rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[0_8px_28px_rgba(0,0,0,0.18)] sm:absolute sm:left-auto sm:right-0 sm:top-[34px] sm:w-[360px]">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3">
            <p className="text-[14px] font-medium text-[color:var(--ink)]">Notifications</p>
            {unread > 0 && <button type="button" onClick={async () => { await api.post("/notifications", { all: true }); reload(); }} className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline">Mark all read</button>}
          </div>
          <ul className="max-h-[min(60vh,420px)] overflow-y-auto">
            {(item?.items ?? []).length === 0 && <li className="px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">You&apos;re all caught up.</li>}
            {(item?.items ?? []).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => go(n.id, n.link)} className={`flex w-full cursor-pointer items-start gap-3 border-b border-[color:var(--subtle-2)] px-4 py-3 text-left hover:bg-[color:var(--subtle)] ${n.read ? "" : "bg-[color:var(--brand-soft)]"}`}>
                  <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[#e5484d]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-[color:var(--ink)]">{n.title}</span>
                    {n.body && <span className="block break-words text-[12px] text-[color:var(--ink-soft)]">{n.body}</span>}
                    <span className="block text-[11px] text-[color:var(--ink-soft)]">{ago(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
