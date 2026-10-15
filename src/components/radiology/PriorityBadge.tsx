import type { RadiologyPriority } from "@/types";

export const PRIORITIES: RadiologyPriority[] = ["Routine", "Urgent", "STAT"];

/** Sort weight — STAT is read first, then Urgent, then Routine. */
export const PRIORITY_RANK: Record<RadiologyPriority, number> = { STAT: 0, Urgent: 1, Routine: 2 };

const STYLES: Record<RadiologyPriority, string> = {
  STAT: "bg-[#ffe9b8] text-[#8a5300] border-[#f3cf7d]",
  Urgent: "bg-[color:var(--subtle)] text-[color:var(--ink)] border-[color:var(--line)]",
  Routine: "bg-transparent text-[color:var(--ink-soft)] border-[color:var(--line)]",
};

/** The priority tag shown on a study. Routine is hidden by default so it only flags what needs attention. */
export function PriorityBadge({ priority, showRoutine = false }: { priority: RadiologyPriority; showRoutine?: boolean }) {
  if (priority === "Routine" && !showRoutine) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-[10px] py-[2px] text-[12px] leading-[16px] whitespace-nowrap ${
        priority === "STAT" ? "font-semibold tracking-wide" : "font-medium"
      } ${STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}
