"use client";

/**
 * Building blocks shared by the role home panels: greeting header, stat-card
 * row, quick-action link grid, and a titled worklist card.
 */
import Link from "next/link";
import { tw } from "@/lib/design-system";
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import type { TaskDTO, StaffDTO } from "@/types/api";

export interface PanelStat {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  bg: string;
}

export function PanelHeader({ name, subtitle, badge }: { name: string; subtitle: string; badge?: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className={`${tw.gutterX} mb-5`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-medium text-[#11111c]">{greeting}, {name} 👋</h1>
          <p className="text-[14px] font-light text-[#57575f]">{subtitle}</p>
        </div>
        {badge && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#dffff3] rounded-full">
            <div className="w-2 h-2 bg-[#00955c] rounded-full animate-pulse" />
            <span className="text-[13px] font-medium text-[#00955c]">{badge}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatRow({ stats }: { stats: PanelStat[] }) {
  return (
    <div className={`${tw.gutterX} mb-5`}>
      <div className="flex gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`${tw.surface.card} ${tw.radius.card} flex-1 p-5 flex flex-col gap-3`}>
            <div className={`w-9 h-9 rounded-[8px] ${s.bg} flex items-center justify-center`}>
              <s.icon size={16} className={s.color} strokeWidth={1.5} />
            </div>
            <span className={`text-[28px] font-medium leading-none ${s.color}`}>{s.value}</span>
            <span className="text-[12px] font-normal text-[#57575f]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {links.map(l => (
        <Link key={l.href + l.label} href={l.href}
          className="border border-[#dedee1] rounded-[10px] p-4 flex items-center gap-3 bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-[#009598] transition-all">
          <div className="w-9 h-9 rounded-[8px] bg-[#e8f7f7] flex items-center justify-center shrink-0">
            <l.icon size={16} className="text-[#009598]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#11111c] truncate">{l.label}</p>
            <p className="text-[11px] font-light text-[#57575f] truncate">{l.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function WorklistCard({ title, action, children }: {
  title: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden flex-1 min-w-0`}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-[#11111c]">{title}</h2>
        {action && (
          <Link href={action.href} className="text-[12px] font-normal text-[#009598] hover:underline whitespace-nowrap">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <div className="py-10 text-center text-[13px] text-[#57575f]">{text}</div>;
}

/**
 * Tasks assigned to the signed-in user, for the role home panels.
 *
 * The task board was only reachable from its own page, so staff had no view of
 * what had been assigned to them. This matches the session user to a staff
 * record by name and lists their open tasks, newest first.
 */
export function MyTasksCard() {
  const { user } = useAuth();
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const { items: tasks, reload } = useList<TaskDTO>("/tasks", { all: true });
  const { run } = useMutation();

  const me = staff.find((s) => s.name === user?.name);
  const mine = tasks
    .filter((t) => (me ? t.assigneeId === me.id : t.assigneeName === user?.name))
    .filter((t) => t.status !== "Done");

  const advance = async (id: number, status: string) => {
    await run(() => api.patch(`/tasks/${id}`, { status }));
    reload();
  };

  const PRIORITY: Record<string, string> = {
    Urgent: "bg-[#ffe9e9] text-[#ff0004]",
    High: "bg-[#fff2e0] text-[#ff9000]",
    Medium: "bg-[#d6eaff] text-[#007cff]",
    Low: "bg-[#f0f0f0] text-[#57575f]",
  };

  return (
    <WorklistCard title={`My Tasks${mine.length ? ` (${mine.length})` : ""}`} action={{ label: "Task board", href: "/tasks" }}>
      {mine.length === 0 ? (
        <EmptyRow text="No open tasks assigned to you." />
      ) : (
        mine.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#f0f0f0] last:border-0">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#11111c] truncate">{t.title}</p>
              <p className="text-[11px] font-light text-[#57575f] truncate">
                {t.goal ? `${t.goal} · ` : ""}Due {formatDate(t.dueDate)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-medium ${PRIORITY[t.priority] ?? ""}`}>
                {t.priority}
              </span>
              <button
                onClick={() => advance(t.id, t.status === "To Do" ? "In Progress" : "Done")}
                className="text-[11px] font-medium text-[#009598] border border-[#009598] px-3 py-[4px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap"
              >
                {t.status === "To Do" ? "Start" : "Mark done"}
              </button>
            </div>
          </div>
        ))
      )}
    </WorklistCard>
  );
}
