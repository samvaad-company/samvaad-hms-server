"use client";

import { useAppSelector } from "@/store";

/** A small "Live" marker for dashboard cards fed by the event stream; says so when the connection is down. */
export function LiveBadge({ className = "" }: { className?: string }) {
  const connection = useAppSelector((s) => s.live.connection);
  if (connection === "idle") return null;
  const live = connection === "live";
  return (
    <span
      title={live ? "Updates appear here the moment they happen" : "Connection lost: reconnecting. This page refreshes itself when it is back."}
      className={`inline-flex items-center gap-[6px] rounded-full px-[8px] py-[2px] text-[11px] font-medium ${live ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#b36200]"} ${className}`}
    >
      <span className={`h-[6px] w-[6px] rounded-full ${live ? "animate-pulse bg-[#00955c]" : "bg-[#ff9000]"}`} />
      {live ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…"}
    </span>
  );
}

/** "New" tag for a row that arrived live. */
export function NewTag() {
  return <span className="rounded-full bg-[color:var(--brand-soft)] px-[7px] py-[1px] text-[10px] font-medium text-[color:var(--brand)]">New</span>;
}
