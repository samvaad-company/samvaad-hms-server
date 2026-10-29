"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import type { OtRecordDTO } from "@/types/api";
import { BookingDetails } from "@/components/ot/BookingDetails";
import { surgeryOf } from "@/components/ot/shared";

/** Side panel for one surgery, opened from any view. */
export function BookingDrawer({ id, canWrite, onClose, onEdit, onDelete, onChanged }: {
  id: number;
  canWrite: boolean;
  onClose: () => void;
  onEdit: (b: OtRecordDTO) => void;
  onDelete: (b: OtRecordDTO) => void;
  onChanged: () => void;
}) {
  const { item: b, reload } = useItem<OtRecordDTO>(`/ot/${id}`);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={b ? surgeryOf(b) : "Surgery"} className="relative flex h-full w-[560px] max-w-full flex-col bg-[color:var(--surface)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-[color:var(--ink)]">{b ? surgeryOf(b) : "…"}</h2>
            {b && <p className="text-[13px] text-[color:var(--ink-soft)]">{b.patientName} · <span className="font-mono">{b.bookingNo}</span></p>}
          </div>
          <div className="flex items-center gap-1">
            <Link href={`/ot/${id}`} aria-label="Open full page" className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"><ExternalLink size={16} /></Link>
            <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><X size={18} /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {b && <BookingDetails b={b} canWrite={canWrite} onChanged={() => { reload(); onChanged(); }} onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} />}
        </div>
      </aside>
    </div>
  );
}
