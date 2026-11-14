"use client";

import { Loader2 } from "lucide-react";

/** A small spinning ring, for "this is loading". */
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} strokeWidth={2} className={`animate-spin text-[color:var(--brand)] ${className}`} aria-hidden />;
}

/** A centred spinner with a short message — for a panel or table that is waiting on its first data. */
export function LoadingBlock({ label = "Loading…", className = "py-12" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`flex items-center justify-center gap-2 text-[13px] text-[color:var(--ink-soft)] ${className}`}>
      <Spinner size={18} /> {label}
    </div>
  );
}
