"use client";

import { useEffect, useRef, useState } from "react";
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
      <div className="bg-[#f6f6f6] flex items-center gap-[15px] p-[3px] rounded-full flex-wrap shrink-0">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange?.(f.id)}
            className={`flex items-center justify-center px-5 py-[5px] rounded-full text-[14px] leading-[19px] font-normal transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === f.id
                ? "bg-[#009598] text-white"
                : "text-[#57575f] hover:text-[#11111c]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + Status dropdown */}
      <div className="flex items-center gap-[15px] flex-wrap">
        <div className="bg-[#f6f6f6] flex items-center gap-[10px] px-3 py-[6px] rounded-full flex-1 min-w-[200px]" style={{ maxWidth: 372 }}>
          <Search size={20} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={controlledSearch ?? ""}
            onChange={e => onSearchChange?.(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-[14px] font-normal text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none"
          />
          {controlledSearch && (
            <button onClick={() => onSearchChange?.("")} className="text-[#57575f] hover:text-[#11111c] text-[18px] leading-none shrink-0">×</button>
          )}
        </div>

        {/* Status filter dropdown — mirrors the filter tabs */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="bg-[#f6f6f6] flex items-center justify-between gap-2 px-[15px] py-2 rounded-full cursor-pointer hover:bg-[#ebebeb] transition-colors"
            style={{ minWidth: 120 }}
          >
            <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">
              {activeFilter === (filters[0]?.id ?? "All") ? statusLabel : activeLabel}
            </span>
            <ChevronDown size={15} strokeWidth={2} className="text-[#11111c]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[44px] z-50 w-[180px] bg-white rounded-[10px] border border-[#dedee1] shadow-lg py-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    onFilterChange?.(f.id);
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-[7px] text-[13px] transition-colors ${
                    activeFilter === f.id
                      ? "bg-[#e8f7f7] text-[#009598] font-medium"
                      : "text-[#11111c] hover:bg-[#f6f6f6]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-[6px] text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap shrink-0"
          >
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
