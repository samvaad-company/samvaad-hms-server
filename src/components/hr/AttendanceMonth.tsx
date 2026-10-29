"use client";

/** One person's attendance for a month, day by day, from the monthly register. */
import { useState } from "react";
import { useItem } from "@/lib/api/hooks";
import { todayLocal } from "@/components/mrd/shared";
import { monthLabel, shiftMonth, Stepper } from "@/components/hr/shared";

interface Register {
  month: string;
  today: string;
  daysInMonth: number;
  staff: { staffId: number; presentDays: number; absentDays: number; days: Record<string, { status: string; punchIn: string; punchOut: string; minutes: number }> }[];
}

const TONE: Record<string, string> = {
  Present: "bg-[#dffff3] text-[#00955c]",
  "In progress": "bg-[#e3efff] text-[#0a5fc4]",
  "No punch-out": "bg-[#fff2d6] text-[#8a5300]",
  Absent: "bg-[#ffe9e9] text-[#ff0004]",
  "On Leave": "bg-[#fff2e0] text-[#c26a00]",
  "Not in yet": "bg-[color:var(--subtle)] text-[color:var(--ink-soft)]",
};
const LETTER: Record<string, string> = { Present: "P", "In progress": "In", "No punch-out": "?", Absent: "A", "On Leave": "L", "Not in yet": "–" };

export function AttendanceMonth({ staffId }: { staffId: number }) {
  const thisMonth = todayLocal().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { item: reg, loading } = useItem<Register>(`/staff/attendance/summary?month=${month}`);
  const row = reg?.staff.find((s) => s.staffId === staffId);
  const leaveDays = row ? Object.values(row.days).filter((d) => d.status === "On Leave").length : 0;
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Stepper label={monthLabel(month)} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} nextDisabled={month >= thisMonth} />
        {row && (
          <div className="flex items-center gap-5">
            {[{ l: "Present", v: row.presentDays, c: "text-[#00955c]" }, { l: "Absent", v: row.absentDays, c: "text-[#ff0004]" }, { l: "On leave", v: leaveDays, c: "text-[#c26a00]" }].map((s) => (
              <div key={s.l} className="flex items-center gap-2"><span className={`text-[22px] font-medium ${s.c}`}>{s.v}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{s.l}</span></div>
            ))}
          </div>
        )}
      </div>
      {!row ? <p className="py-10 text-center text-[14px] text-[color:var(--ink-soft)]">{loading ? "Loading…" : "No attendance for this month."}</p> : (
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}>
          {Array.from({ length: reg!.daysInMonth }, (_, i) => i + 1).map((d) => {
            const c = row.days[String(d)];
            return (
              <div key={d} title={c ? `${c.status}${c.punchIn ? ` · in ${c.punchIn}` : ""}${c.punchOut ? ` · out ${c.punchOut}` : ""}` : "Before joining"} className={`flex flex-col items-center gap-[2px] rounded-[6px] p-2 ${c ? TONE[c.status] ?? "" : "opacity-30"}`}>
                <span className="text-[10px] font-medium">{d}</span>
                <span className="text-[10px]">{c ? LETTER[c.status] ?? "" : ""}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[12px] text-[color:var(--ink-soft)]">P present · A no punch and no leave (weekly offs count here) · L approved leave · ? punched in but never out.</p>
    </div>
  );
}
