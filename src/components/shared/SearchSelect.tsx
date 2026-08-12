"use client";

/**
 * Searchable dropdown for long option lists (patients, doctors, medicines…).
 * Renders like FormSelect but opens a panel with a search box that filters
 * options as you type. The panel renders through a portal to `document.body`,
 * fixed-positioned off the trigger's own rect — so it floats above scrollable
 * or `overflow-hidden` ancestors (a form card, a table) instead of being
 * clipped, and flips above the trigger when there isn't room below.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

interface Position {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

const GAP = 4;
const VIEWPORT_MARGIN = 8;
const PANEL_HEIGHT_ESTIMATE = 270; // search box + max-h-[220px] list + borders

export function SearchSelect({
  placeholder = "Select…",
  options,
  value,
  onChange,
  disabled,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Two-pass placement: mount the panel hidden to measure its real height,
  // then decide below-vs-above and reveal it — all before paint, so there's
  // no visible flash.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const panelHeight = panel.offsetHeight || PANEL_HEIGHT_ESTIMATE;
    const spaceBelow = window.innerHeight - rect.bottom;
    const fitsBelow = spaceBelow >= panelHeight + GAP + VIEWPORT_MARGIN;
    const fitsAbove = rect.top >= panelHeight + GAP + VIEWPORT_MARGIN;
    const openAbove = !fitsBelow && fitsAbove;

    setPos({
      left: rect.left,
      width: rect.width,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    });
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Scrolling the results list itself shouldn't close the panel — only a
    // scroll elsewhere (the page, a table) invalidates the fixed position.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
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
    <>
      <button
        ref={triggerRef}
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

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 bg-white rounded-[10px] border border-[#dedee1] shadow-lg overflow-hidden"
            style={
              pos
                ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }
                : { left: 0, top: 0, width: 0, visibility: "hidden" }
            }
          >
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
          </div>,
          document.body,
        )}
    </>
  );
}
