"use client";

import { AlertTriangle, Zap } from "lucide-react";
import type { AiQuotaDTO } from "@/types/api";

const fmt = (n: number) => n.toLocaleString("en-IN");
const renewal = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" });

/**
 * The person's AI token allowance for the month: a thin meter while they have tokens,
 * and a clear notice (who to ask, when it renews) once they have used them all.
 */
export function AiQuotaBar({ quota }: { quota: AiQuotaDTO | null }) {
  if (!quota) return null;

  if (quota.blocked) {
    return (
      <div role="alert" className="shrink-0 flex items-start gap-2 px-4 py-3 bg-[#ffe9e9] dark:bg-[#3a1d1f] border-t border-[#ffc8c8] dark:border-[#5a2a2d] text-[12px] leading-[17px] text-[#b4000a] dark:text-[#ff9a9d]">
        <AlertTriangle size={15} className="shrink-0 mt-[1px]" />
        <span>
          <b className="font-medium">Your KAYA AI access is paused.</b> Please contact your administrator or manager to turn it back on.
        </span>
      </div>
    );
  }

  if (quota.exceeded) {
    return (
      <div role="alert" className="shrink-0 flex items-start gap-2 px-4 py-3 bg-[#ffe9e9] dark:bg-[#3a1d1f] border-t border-[#ffc8c8] dark:border-[#5a2a2d] text-[12px] leading-[17px] text-[#b4000a] dark:text-[#ff9a9d]">
        <AlertTriangle size={15} className="shrink-0 mt-[1px]" />
        <span>
          <b className="font-medium">Your monthly KAYA AI quota is used up</b> ({fmt(quota.used)} of {fmt(quota.limit ?? 0)} tokens).
          Please contact your administrator or manager to increase your limit. It renews on {renewal(quota.renewsOn)}.
        </span>
      </div>
    );
  }

  if (quota.limit == null) {
    return (
      <div className="shrink-0 flex items-center gap-[6px] px-4 py-[6px] text-[11px] text-[color:var(--ink-soft)] border-t border-[color:var(--line)]">
        <Zap size={11} /> {fmt(quota.used)} tokens used this month · no limit
      </div>
    );
  }

  const share = Math.min(1, quota.used / Math.max(1, quota.limit));
  const low = share >= 0.8;
  return (
    <div className="shrink-0 px-4 pt-2 pb-[6px] border-t border-[color:var(--line)]">
      <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--ink-soft)]">
        <span className="flex items-center gap-[6px]"><Zap size={11} /> {fmt(quota.used)} of {fmt(quota.limit)} tokens this month</span>
        <span className={low ? "font-medium text-[#c8001a]" : ""}>{fmt(quota.remaining ?? 0)} left</span>
      </div>
      <div className="mt-[5px] h-[4px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${low ? "bg-[#ff4d4f]" : "bg-[color:var(--brand)]"}`} style={{ width: `${Math.max(2, share * 100)}%` }} />
      </div>
      {low && <p className="mt-1 text-[11px] text-[#c8001a]">Running low. Ask your administrator or manager if you need more; it renews on {renewal(quota.renewsOn)}.</p>}
    </div>
  );
}
