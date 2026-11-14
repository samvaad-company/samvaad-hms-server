"use client";

/**
 * Choose which batch of a medicine a line comes from. Loads the batches that still hold stock, earliest expiry first, and picks
 * the earliest one in date by default (so the line is never left without a batch).
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import type { PharmacyBatchDTO } from "@/types/api";

export function BatchSelect({ itemId, value, onChange }: { itemId: number | undefined; value: string; onChange: (batchNo: string) => void }) {
  const [batches, setBatches] = useState<PharmacyBatchDTO[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!itemId) { setBatches([]); return; }
    api.get<PharmacyBatchDTO[]>(`/pharmacy/${itemId}/batches`).then((list) => {
      if (cancelled) return;
      setBatches(list);
      if (!list.some((b) => b.batchNo === value && !b.expired)) onChange(list.find((b) => !b.expired)?.batchNo ?? "");
    }).catch(() => { if (!cancelled) setBatches([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  if (batches.length === 0) return null;
  return (
    <label className="flex flex-wrap items-center gap-2 pl-1 text-[12px] text-[color:var(--ink-soft)]">
      Batch
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Batch" title="The earliest-expiring batch in date is chosen by default"
        className="h-[30px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:outline-none">
        {batches.map((b) => <option key={b.id} value={b.batchNo} disabled={b.expired}>{`${b.batchNo}${b.expiryDate ? ` · exp ${formatDate(b.expiryDate)}` : ""} · ${b.quantity} in stock${b.expired ? " · expired" : ""}`}</option>)}
      </select>
    </label>
  );
}
