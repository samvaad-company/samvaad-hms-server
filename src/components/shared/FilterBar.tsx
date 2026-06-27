"use client";

import { Search, ChevronDown, SlidersHorizontal, LayoutList, LayoutGrid } from "lucide-react";

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
}

export function FilterBar({
  filters,
  searchPlaceholder,
  statusLabel = "Status",
  activeFilter: controlledFilter,
  onFilterChange,
  searchQuery: controlledSearch,
  onSearchChange,
}: FilterBarProps) {
  const activeFilter = controlledFilter ?? filters[0]?.id ?? "All";

  return (
    <div className="flex items-center justify-between px-5 py-[25px]">
      {/* Filter Tabs */}
      <div className="bg-[#f6f6f6] flex items-center gap-[15px] p-[3px] rounded-full">
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

      {/* Search + Controls */}
      <div className="flex items-center gap-[15px]">
        <div className="bg-[#f6f6f6] flex items-center gap-[10px] px-3 py-[6px] rounded-full" style={{ width: 372 }}>
          <Search size={20} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={controlledSearch ?? ""}
            onChange={e => onSearchChange?.(e.target.value)}
            className="flex-1 bg-transparent text-[14px] font-normal text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none"
          />
          {controlledSearch && (
            <button onClick={() => onSearchChange?.("")} className="text-[#57575f] hover:text-[#11111c] text-[18px] leading-none">×</button>
          )}
        </div>

        <div className="bg-[#f6f6f6] flex items-center justify-between px-[15px] py-2 rounded-full cursor-pointer" style={{ width: 107 }}>
          <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">{statusLabel}</span>
          <ChevronDown size={15} strokeWidth={2} className="text-[#11111c]" />
        </div>

        <div className="bg-[#f6f6f6] flex items-center gap-[5px] px-[10px] py-[6px] rounded-full cursor-pointer hover:bg-[#ebebeb] transition-colors">
          <SlidersHorizontal size={22} strokeWidth={1.5} className="text-[#11111c]" />
          <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">Filter</span>
        </div>

        <div className="bg-[#f6f6f6] flex items-center p-[2px] rounded-full">
          <button className="flex items-center justify-center p-[5px] rounded-full bg-[#009598] text-white">
            <LayoutList size={22} strokeWidth={1.5} />
          </button>
          <button className="flex items-center justify-center p-[5px] rounded-full text-[#57575f] hover:text-[#11111c]">
            <LayoutGrid size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
