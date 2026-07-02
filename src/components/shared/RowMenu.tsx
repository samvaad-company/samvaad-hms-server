"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Self-contained "⋮" action menu for table rows. Stops event propagation so it
 * works inside clickable/link rows, closes on outside click or Escape, and
 * renders a small dropdown of actions.
 */
export function RowMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors"
        aria-label="Row actions"
      >
        <MoreVertical size={24} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[28px] z-50 w-[160px] bg-white rounded-[10px] border border-[#dedee1] shadow-lg py-1"
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
              className={`w-full text-left px-3 py-[7px] text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                a.danger
                  ? "text-[#ff0004] hover:bg-[#ffe9e9]"
                  : "text-[#11111c] hover:bg-[#f6f6f6]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
