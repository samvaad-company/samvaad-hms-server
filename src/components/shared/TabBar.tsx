"use client";

import type { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Right-aligned content on the tab row (e.g. a filter that applies to every tab). */
  trailing?: ReactNode;
}

export function TabBar({ tabs, activeTab, onTabChange, trailing }: TabBarProps) {
  return (
    <div className="flex items-center border-b border-[color:var(--line)] px-3 sm:px-5 shrink-0 max-lg:flex-wrap max-lg:gap-2 max-lg:py-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-[6px] px-4 py-[14px] text-[14px] font-normal border-b-2 transition-colors whitespace-nowrap cursor-pointer shrink-0 max-lg:rounded-full max-lg:border max-lg:py-[7px] max-lg:px-3 ${
            activeTab === tab.id
              ? "border-[color:var(--brand)] text-[color:var(--brand)] max-lg:bg-[color:var(--brand-soft)]"
              : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] max-lg:border-[color:var(--line)]"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`text-[11px] px-[7px] py-[2px] rounded-full font-medium ${
                activeTab === tab.id
                  ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                  : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
      {trailing && <div className="ml-auto pl-4 py-[6px] max-lg:pl-0 max-lg:w-full max-lg:ml-0">{trailing}</div>}
    </div>
  );
}
