"use client";

/**
 * The OT register: every surgery in a date range, newest first, with the real duration once it has been done.
 * "Register PDF" prints the table on its own (choose Save as PDF in the print dialog).
 */
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { printElement } from "@/lib/print";
import { formatDate } from "@/lib/dates";
import type { OtRecordDTO } from "@/types/api";
import { addDays, btn, STATUS_STYLE, surgeryOf, todayLocal } from "@/components/ot/shared";

export function RegisterView({ bookings, onOpen }: { bookings: OtRecordDTO[]; onOpen: (b: OtRecordDTO) => void }) {
  const [from, setFrom] = useState(addDays(todayLocal(), -30));
  const [to, setTo] = useState(todayLocal());
  const tableRef = useRef<HTMLDivElement>(null);

  const rows = bookings
    .filter((b) => b.scheduledDate >= from && b.scheduledDate <= to)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate) || (b.startMinute ?? 0) - (a.startMinute ?? 0));
  const inputCls = "h-[40px] rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[14px] text-[color:var(--ink)]";

  return (
    <div className="p-5">
      <div className="flex items-end gap-3 flex-wrap mb-4">
        <label className="flex flex-col gap-1 text-[13px] font-medium text-[color:var(--ink)]">From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-[color:var(--ink)]">To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        <button onClick={() => printElement(tableRef.current, `OT register ${from} to ${to}`)} disabled={rows.length === 0} className={`${btn.base} ${btn.ghost} !h-[40px]`}>
          <Download size={14} /> Register PDF
        </button>
        <span className="ml-auto text-[13px] text-[color:var(--ink-soft)]">{rows.length} {rows.length === 1 ? "entry" : "entries"}</span>
      </div>

      <div ref={tableRef} className="rounded-[10px] border border-[color:var(--line)] overflow-hidden bg-[color:var(--surface)]">
        <p className="hidden print:block px-4 pt-3 text-[13px] font-semibold">Operation Theatre register · {formatDate(from)} to {formatDate(to)}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-[color:var(--line)] text-[13px] text-[color:var(--ink-soft)]">
                {["Date", "Booking no.", "Patient", "Surgeon", "Surgery", "Duration", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} onClick={() => onOpen(b)} className="cursor-pointer border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)] text-[14px] text-[color:var(--ink)]">
                  <td className="px-4 py-[10px] font-mono text-[13px] whitespace-nowrap">{b.scheduledDate}</td>
                  <td className="px-4 py-[10px] font-mono text-[13px] whitespace-nowrap">{b.bookingNo}</td>
                  <td className="px-4 py-[10px]">{b.patientName} {b.patientCode && <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{b.patientCode}</span>}</td>
                  <td className="px-4 py-[10px]">{b.surgeon || "—"}</td>
                  <td className="px-4 py-[10px]">{surgeryOf(b)}</td>
                  <td className="px-4 py-[10px] font-mono text-[13px] whitespace-nowrap" title={b.actualMin != null ? "Actual" : "Planned"}>{b.actualMin ?? b.durationMin} min</td>
                  <td className="px-4 py-[10px]"><span className={`inline-flex rounded-full px-[10px] py-[2px] text-[12px] ${STATUS_STYLE[b.status].pill}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="px-4 py-12 text-center text-[14px] text-[color:var(--ink-soft)]">No surgeries between these dates.</p>}
      </div>
    </div>
  );
}
