"use client";

/**
 * Searchable dropdown for long option lists (patients, doctors, medicines…).
 * Renders like FormSelect but opens a panel with a search box that filters
 * options as you type.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Extra searchable text (e.g. patient code, phone). */
  hint?: string;
}

interface SearchSelectProps {
  placeholder?: string;
  options: SearchSelectOption[];
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}

export function SearchSelect({
  placeholder = "Select…",
  options,
  value,
  onChange,
  disabled,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // Focus the search box as soon as the panel opens.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] flex items-center justify-between gap-2 text-left focus:outline-none focus:border-[#009598] transition-colors disabled:opacity-50"
      >
        <span
          className={`text-[14px] font-normal truncate ${selected ? "text-[#11111c]" : "text-[#57575f] opacity-70"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} strokeWidth={2} className="text-[#57575f] shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[46px] z-50 bg-white rounded-[10px] border border-[#dedee1] shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f0f0f0]">
            <Search size={14} className="text-[#57575f] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="flex-1 bg-transparent text-[13px] text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[#57575f]">No matches.</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-[7px] flex items-center justify-between gap-2 transition-colors ${
                    o.value === value
                      ? "bg-[#e8f7f7] text-[#009598]"
                      : "text-[#11111c] hover:bg-[#f6f6f6]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] truncate">{o.label}</span>
                    {o.hint && (
                      <span className="block text-[11px] text-[#57575f] truncate">{o.hint}</span>
                    )}
                  </span>
                  {o.value === value && <Check size={14} className="shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
