"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, ChevronDown, type LucideIcon } from "lucide-react";

interface FilterTab {
  id: string;
  label: string;
}

interface FilterBarProps {
  filters: FilterTab[];
  searchPlaceholder: string;
  statusLabel?: string;
  // Controlled
  activeFilter?: string;
  onFilterChange?: (id: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  /** Optional trailing action button (e.g. Add, Export). */
  action?: { label: string; icon?: LucideIcon; onClick: () => void };
  /** Extra control at the end of the bar, e.g. a view switch. */
  trailing?: ReactNode;
}

export function FilterBar({
  filters,
  searchPlaceholder,
  statusLabel = "Status",
  activeFilter: controlledFilter,
  onFilterChange,
  searchQuery: controlledSearch,
  onSearchChange,
  action,
  trailing,
}: FilterBarProps) {
  const activeFilter = controlledFilter ?? filters[0]?.id ?? "All";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const activeLabel = filters.find((f) => f.id === activeFilter)?.label ?? statusLabel;

  return (
    <div className="flex items-center justify-between flex-wrap gap-x-[15px] gap-y-3 px-5 py-[25px]">
      {/* Filter Tabs */}
      <div className="bg-[color:var(--subtle)] flex items-center gap-[15px] p-[3px] rounded-full flex-wrap shrink-0">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange?.(f.id)}
            className={`flex items-center justify-center px-5 py-[5px] rounded-full text-[14px] leading-[19px] font-normal transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === f.id
                ? "bg-[color:var(--brand)] text-white"
                : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + Status dropdown */}
      <div className="flex items-center gap-[15px] flex-wrap">
        <div className="bg-[color:var(--subtle)] flex items-center gap-[10px] px-3 py-[6px] rounded-full flex-1 min-w-[200px]" style={{ maxWidth: 372 }}>
          <Search size={20} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={controlledSearch ?? ""}
            onChange={e => onSearchChange?.(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-[14px] font-normal text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none"
          />
          {controlledSearch && (
            <button onClick={() => onSearchChange?.("")} className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] text-[18px] leading-none shrink-0">×</button>
          )}
        </div>

        {/* Status filter dropdown — mirrors the filter tabs */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="bg-[color:var(--subtle)] flex items-center justify-between gap-2 px-[15px] py-2 rounded-full cursor-pointer hover:bg-[#ebebeb] transition-colors"
            style={{ minWidth: 120 }}
          >
            <span className="text-[14px] font-normal text-[color:var(--ink)] leading-[19px] whitespace-nowrap">
              {activeFilter === (filters[0]?.id ?? "All") ? statusLabel : activeLabel}
            </span>
            <ChevronDown size={15} strokeWidth={2} className="text-[color:var(--ink)]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[44px] z-50 w-[180px] bg-[color:var(--surface)] rounded-[10px] border border-[color:var(--line)] shadow-lg py-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    onFilterChange?.(f.id);
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-[7px] text-[13px] transition-colors ${
                    activeFilter === f.id
                      ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)] font-medium"
                      : "text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {trailing}

        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-[6px] text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors whitespace-nowrap shrink-0"
          >
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
