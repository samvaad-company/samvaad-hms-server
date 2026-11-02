"use client";

import { useItem } from "@/lib/api/hooks";
import type { TrainingTeamDTO } from "@/types/api";
import { lessonById } from "@/types/training";

const when = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** How everyone is getting on against the lessons recommended to their role. */
export function TeamProgress() {
  const { item, error } = useItem<TrainingTeamDTO>("/training/team");
  if (error) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Team progress is available to people who manage staff.</p>;
  if (!item) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <div className="p-5">
      <p className="mb-3 text-[13px] text-[color:var(--ink-soft)]">{item.members.length} people · on average <b className="font-mono text-[color:var(--ink)]">{item.average}%</b> of their recommended lessons done</p>
      <div className="overflow-x-auto rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full min-w-[760px] border-collapse text-[14px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Person</th><th className="px-4 py-2 font-medium">Role</th><th className="px-4 py-2 font-medium">Recommended lessons</th><th className="px-4 py-2 font-medium">Last active</th></tr></thead>
          <tbody>
            {item.members.map((m) => (
              <tr key={m.userId} className="border-t border-[color:var(--line)] align-top">
                <td className="px-4 py-[11px] font-medium">{m.name}</td>
                <td className="px-4 py-[11px] text-[13px] text-[color:var(--ink-soft)]">{m.role}</td>
                <td className="px-4 py-[11px]">
                  <div className="flex items-center gap-3"><span className="h-[7px] w-[140px] overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className="block h-full rounded-full" style={{ width: `${m.pct}%`, background: m.pct >= 100 ? "#12a150" : "var(--brand)" }} /></span><span className="font-mono text-[13px]">{m.done}/{m.recommended}</span><span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{m.pct}%</span></div>
                  {(m.completed.length > 0 || m.inProgress.length > 0) && (
                    <p className="mt-[6px] flex flex-wrap gap-1 text-[11px]">
                      {m.completed.map((id) => <span key={id} className="rounded-full border border-[#9fe3c6] bg-[#e9fbf2] px-2 py-[1px] text-[#0b7a47]">{lessonById(id)?.title ?? id}</span>)}
                      {m.inProgress.map((id) => <span key={id} className="rounded-full border border-[#f1cf9b] bg-[#fff6e8] px-2 py-[1px] text-[#8a5300]">{lessonById(id)?.title ?? id} …</span>)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-[11px] font-mono text-[12px] text-[color:var(--ink-soft)]">{when(m.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
