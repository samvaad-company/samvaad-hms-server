"use client";

import { useEffect, useRef, useState } from "react";
import { type LucideIcon, Calendar, ChevronDown, Plus } from "lucide-react";
import { StatPill } from "./StatPill";
import { DATE_RANGES, type DateRangeId } from "@/lib/dates";

interface StatItem {
  icon: LucideIcon;
  value: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  stats: StatItem[];
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
  };
  /** Show the date-range filter (requires range + onRangeChange to be functional). */
  dateRange?: boolean;
  range?: DateRangeId;
  onRangeChange?: (range: DateRangeId) => void;
}

export function PageHeader({
  title,
  subtitle,
  stats,
  action,
  dateRange = true,
  range = "all",
  onRangeChange,
}: PageHeaderProps) {
  const ActionIcon = action?.icon ?? Plus;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const rangeLabel = DATE_RANGES.find((r) => r.id === range)?.label ?? "All time";

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-[30px] pt-[16px] pb-[12px]">
      <div className="flex min-w-0 flex-col gap-[2px]">
        <h1 className="text-[24px] font-medium text-[color:var(--ink)] leading-[28px] capitalize">
          {title}
        </h1>
        <p className="text-[13px] font-light text-[color:var(--ink-soft)] leading-[17px]">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-[10px] mt-[2px] shrink-0">
        {stats.map((s, i) => (
          <StatPill key={i} {...s} />
        ))}

        {dateRange && onRangeChange && (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="bg-[color:var(--surface)] flex items-center gap-[8px] px-[15px] py-[6px] rounded-full cursor-pointer hover:bg-[color:var(--subtle)] transition-colors"
            >
              <Calendar size={18} strokeWidth={1.5} className="text-[color:var(--ink)]" />
              <span className="text-[13px] font-normal text-[color:var(--ink)] leading-[18px] whitespace-nowrap">
                {rangeLabel}
              </span>
              <ChevronDown size={14} strokeWidth={2} className="text-[color:var(--ink)]" />
            </button>

            {open && (
              <div className="absolute right-0 top-[38px] z-50 w-[160px] bg-[color:var(--surface)] rounded-[10px] border border-[color:var(--line)] shadow-lg py-1">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onRangeChange(r.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-[7px] text-[13px] transition-colors ${
                      range === r.id
                        ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)] font-medium"
                        : "text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {action && (
          <button
            onClick={action.onClick}
            className="bg-[color:var(--brand)] flex items-center gap-[5px] px-[15px] py-[6px] rounded-full cursor-pointer hover:bg-[color:var(--brand-hover)] transition-colors"
          >
            <ActionIcon size={18} strokeWidth={1.5} className="text-white" />
            <span className="text-[13px] font-normal text-white leading-[18px] whitespace-nowrap">
              {action.label}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
