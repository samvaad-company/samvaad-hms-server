"use client";

/** File tracking → Dashboard: where the files are, at a glance. */
import { useItem } from "@/lib/api/hooks";
import type { MrdFileSummaryDTO } from "@/types/api";
import { StatCard, StatGrid } from "@/components/mrd/shared";

export function FileSummaryView() {
  const { item: s } = useItem<MrdFileSummaryDTO>("/mrd/files/summary");
  const v = (n: number | undefined) => (s ? n ?? 0 : "–");
  return (
    <StatGrid cols={3}>
      <StatCard label="Available" value={v(s?.available)} />
      <StatCard label="Checked out" value={v(s?.checkedOut)} />
      <StatCard label="In transit" value={v(s?.inTransit)} />
      <StatCard label="Overdue" value={v(s?.overdue)} />
      <StatCard label="Pending requests" value={v(s?.pendingRequests)} />
      <StatCard label="Archived" value={v(s?.archived)} />
    </StatGrid>
  );
}
