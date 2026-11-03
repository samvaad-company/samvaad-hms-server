"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { useIsCompact } from "@/lib/use-media-query";

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Only listed on phones and tablets: the row hides the inline button for this action there and moves it into the menu. */
  mobileOnly?: boolean;
}

interface Position {
  left: number;
  top?: number;
  bottom?: number;
}

const GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Self-contained "⋮" action menu for table rows (`compact` shrinks the icon for tight lists). Stops event propagation so it
 * works inside clickable/link rows, closes on outside click, Escape, or
 * scroll, and renders its dropdown through a portal to `document.body` —
 * fixed-positioned off the button's own rect — so it floats above the table's
 * scrollable/clipped ancestors instead of being cut off or forcing a nested
 * scrollbar. Opens below the button by default, but flips above it when
 * there isn't enough room left in the viewport (e.g. the last rows of a
 * long table), so the menu is never rendered off-screen.
 */
export function RowMenu({ actions: allActions, compact = false }: { actions: RowAction[]; compact?: boolean }) {
  const smallScreen = useIsCompact();
  const actions = smallScreen ? allActions : allActions.filter((a) => !a.mobileOnly);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Two-pass placement: mount the menu hidden to measure its real height,
  // then decide below-vs-above and reveal it — all before paint, so there's
  // no visible flash.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;

    const buttonRect = button.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const fitsBelow = spaceBelow >= menuHeight + GAP + VIEWPORT_MARGIN;
    const fitsAbove = buttonRect.top >= menuHeight + GAP + VIEWPORT_MARGIN;
    const openAbove = !fitsBelow && fitsAbove;
    // Line the menu's right edge up with the button, then keep the whole menu on screen (a button near the left edge would push it off).
    const menuWidth = menu.offsetWidth;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(buttonRect.right - menuWidth, window.innerWidth - menuWidth - VIEWPORT_MARGIN));

    setPos(
      openAbove
        ? { bottom: window.innerHeight - buttonRect.top + GAP, left }
        : { top: buttonRect.bottom + GAP, left },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Any scroll can invalidate the fixed position, so close rather than chase it.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`cursor-pointer text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors shrink-0 ${compact ? "p-1 max-lg:p-2 rounded-[6px] hover:bg-black/5" : "pr-1"}`}
        aria-label="Row actions"
      >
        <MoreVertical size={compact ? 16 : 24} strokeWidth={1.5} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-[190px] max-w-[calc(100vw-16px)] lg:w-[160px] bg-[color:var(--surface)] rounded-[10px] border border-[color:var(--line)] shadow-lg py-1"
            style={
              pos
                ? { top: pos.top, bottom: pos.bottom, left: pos.left }
                : { top: 0, left: 0, visibility: "hidden" }
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                disabled={a.disabled}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  a.onClick();
                }}
                className={`w-full text-left px-3 py-[11px] lg:py-[7px] text-[14px] lg:text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  a.danger
                    ? "text-[#ff0004] hover:bg-[#ffe9e9]"
                    : "text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
