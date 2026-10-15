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
    <div className="flex items-center border-b border-[color:var(--line)] px-5 shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-[6px] px-4 py-[14px] text-[14px] font-normal border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === tab.id
              ? "border-[color:var(--brand)] text-[color:var(--brand)]"
              : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
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
      {trailing && <div className="ml-auto pl-4 py-[6px] shrink-0">{trailing}</div>}
    </div>
  );
}
