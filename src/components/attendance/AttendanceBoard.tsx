"use client";

/**
 * Staff attendance board — a daily roster (with manual punch for staff who
 * can't scan) and a monthly register, one row per staff member.
 * Shared by the Staff → Attendance tab and the /attendance page.
 */
import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { todayIso } from "@/lib/dates";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/shared/Modal";
import type {
  StaffDTO,
  StaffAttendanceDTO,
  AttendanceDayCellDTO,
  AttendanceDayStatus,
  AttendanceSummaryDTO,
  AttendanceSummaryStaffDTO,
  AttendanceHistoryDTO,
} from "@/types/api";

const STATUS_BADGE: Record<AttendanceDayStatus, string> = {
  "Present":      "bg-[#dffff3] text-[#00955c]",
  "In progress":  "bg-[#d6eaff] text-[#007cff]",
  "No punch-out": "bg-[#fff2e0] text-[#ff9000]",
  "Absent":       "bg-[#ffe9e9] text-[#ff0004]",
  "On Leave":     "bg-[#f0f0f0] text-[#57575f]",
  "Not in yet":   "bg-[#f0f0f0] text-[#57575f]",
};

/** Cell colour in the monthly grid. */
const CELL_CLR: Record<AttendanceDayStatus, string> = {
  "Present":      "bg-[#00955c] text-white",
  "In progress":  "bg-[#007cff] text-white",
  "No punch-out": "bg-[#ff9000] text-white",
  "Absent":       "bg-[#ffd3d3] text-[#ff0004]",
  "On Leave":     "bg-[#e4e4e7] text-[#57575f]",
  "Not in yet":   "bg-[#f0f0f0] text-[#57575f]",
};
const CELL_LABEL: Record<AttendanceDayStatus, string> = {
  "Present": "P", "In progress": "•", "No punch-out": "!", "Absent": "A", "On Leave": "L", "Not in yet": "–",
};

const hhmm = (mins: number) =>
  mins > 0 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : "—";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AttendanceBoard({
  canWrite,
  height = 555,
  initialView = "daily",
}: {
  canWrite: boolean;
  height?: number | string;
  initialView?: "daily" | "monthly" | "history";
}) {
  const [view, setView] = useState<"daily" | "monthly" | "history">(initialView);
  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex items-center gap-1 px-5 pt-3">
        {(["daily", "monthly", "history"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-[6px] rounded-full text-[13px] transition-colors cursor-pointer ${
              view === v ? "bg-[#009598] text-white" : "text-[#57575f] hover:bg-[#f6f6f6]"
            }`}
          >
            {v === "daily" ? "Daily check" : v === "monthly" ? "Monthly register" : "Punch history"}
          </button>
        ))}
      </div>
      {view === "daily" ? <DailyView canWrite={canWrite} /> : view === "monthly" ? <MonthlyView /> : <HistoryView />}
    </div>
  );
}

// ─── Daily ────────────────────────────────────────────────────────────────────

function dailyStatus(
  member: StaffDTO,
  rec: StaffAttendanceDTO | undefined,
  isToday: boolean,
): AttendanceDayStatus {
  if (rec) {
    if (rec.punchOut) return "Present";
    return isToday ? "In progress" : "No punch-out";
  }
  if (member.status === "On Leave") return "On Leave";
  return isToday ? "Not in yet" : "Absent";
}

function DailyView({ canWrite }: { canWrite: boolean }) {
  const [date, setDate] = useState(todayIso());
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const { items: records, reload } = useList<StaffAttendanceDTO>("/staff/attendance", {
    all: true, work_date: date,
  });
  const { run, loading } = useMutation();
  const [notice, setNotice] = useState<string | null>(null);

  const roster = staff.filter((s) => s.status !== "Inactive");
  const byStaff = new Map(records.map((r) => [r.staffId, r]));
  const isToday = date === todayIso();

  async function punch(staffId: number, action: "in" | "out") {
    setNotice(null);
    try {
      await run(() => api.post("/staff/attendance/punch", { staffId, action }));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not record the punch.");
    }
  }

  const rows = roster.map((m) => ({ m, rec: byStaff.get(m.id), status: dailyStatus(m, byStaff.get(m.id), isToday) }));
  const count = (...s: AttendanceDayStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const cols = "1.5fr 1.1fr 110px 110px 110px 110px 170px";

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-3 mt-3 bg-[#f6f6f6] border-y border-[#dedee1]">
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-[34px] bg-white border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
        />
        <div className="flex items-center gap-5 ml-4 flex-wrap">
          {[
            { l: "Present", v: count("Present", "In progress", "No punch-out"), c: "text-[#00955c]" },
            { l: isToday ? "Not in yet" : "Absent", v: count("Absent", "Not in yet"), c: "text-[#ff0004]" },
            { l: "On Leave", v: count("On Leave"), c: "text-[#ff9000]" },
          ].map((s) => (
            <div key={s.l} className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">{s.l}</span>
              <span className={`text-[18px] font-medium leading-none ${s.c}`}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      {notice && (
        <div className="mx-5 mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{notice}</div>
      )}

      <div className="overflow-auto flex-1">
        <div className="min-w-[860px]">
          <div className="grid items-center px-5 h-10 bg-[#f2f3f3] text-[12px] font-medium text-[#11111c]" style={{ gridTemplateColumns: cols }}>
            <span>Staff Member</span><span>Role</span><span>Status</span><span>Punch In</span>
            <span>Punch Out</span><span>Hours</span><span>Action</span>
          </div>
          {rows.length === 0 && (
            <div className="py-12 text-center text-[14px] text-[#57575f]">No active staff.</div>
          )}
          {rows.map(({ m, rec, status }) => (
            <div key={m.id} className="grid items-center px-5 h-[56px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors" style={{ gridTemplateColumns: cols }}>
              <span className="text-[13px] font-medium text-[#11111c] truncate">{m.name}</span>
              <span className="text-[13px] text-[#57575f] truncate">{m.role}</span>
              <span>
                <span className={`inline-block text-[11px] px-[10px] py-[3px] rounded-full ${STATUS_BADGE[status]}`}>{status}</span>
              </span>
              <span className="text-[13px] text-[#11111c]">
                {rec?.punchIn || "—"}
                {rec?.method === "qr" && (
                  <span className="block text-[10px] font-light text-[#009598]" title="Scanned in from the attendance app">
                    QR{rec.inDistanceM != null ? ` · ${rec.inDistanceM} m` : ""}
                  </span>
                )}
              </span>
              <span className="text-[13px] text-[#11111c]">
                {rec?.punchOut || "—"}
                {rec?.method === "qr" && rec.punchOut && rec.outDistanceM != null && (
                  <span className="block text-[10px] font-light text-[#009598]">QR · {rec.outDistanceM} m</span>
                )}
              </span>
              <span className="text-[13px] text-[#57575f]">{hhmm(rec?.minutes ?? 0)}</span>
              <div className="flex items-center gap-2">
                {!isToday || !canWrite ? (
                  <span className="text-[12px] text-[#57575f]">{rec ? "Recorded" : "No record"}</span>
                ) : !rec ? (
                  <button onClick={() => punch(m.id, "in")} disabled={loading}
                    className="text-[12px] text-white bg-[#009598] px-3 py-[5px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 cursor-pointer">
                    Punch In
                  </button>
                ) : !rec.punchOut ? (
                  <button onClick={() => punch(m.id, "out")} disabled={loading}
                    className="text-[12px] text-[#ff9000] border border-[#ff9000] px-3 py-[5px] rounded-full hover:bg-[#fff2e0] transition-colors disabled:opacity-50 cursor-pointer">
                    Punch Out
                  </button>
                ) : (
                  <span className="text-[12px] text-[#00955c]">Shift complete</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Punch history ────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

function HistoryView() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(todayIso());
  const [staffId, setStaffId] = useState("");
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const qs = new URLSearchParams({ from, to, ...(staffId ? { staffId } : {}) }).toString();
  const { item, loading } = useItem<AttendanceHistoryDTO>(`/staff/attendance/history?${qs}`);
  const events = item?.events ?? [];
  const cols = "130px 1.4fr 100px 100px 1fr 100px";
  const field = "h-[34px] bg-white border border-[#dedee1] rounded-[8px] px-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors";

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 mt-3 bg-[#f6f6f6] border-y border-[#dedee1] flex-wrap">
        <label className="flex items-center gap-2 text-[12px] text-[#57575f]">From
          <input type="date" className={field} value={from} max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[#57575f]">To
          <input type="date" className={field} value={to} min={from} max={todayIso()}
            onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <div className="relative">
          <select className={`${field} appearance-none pr-9 min-w-[180px] cursor-pointer`} value={staffId}
            onChange={(e) => setStaffId(e.target.value)} aria-label="Staff member">
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57575f] pointer-events-none" />
        </div>
        <span className="ml-auto text-[12px] text-[#57575f]">{events.length} punch{events.length === 1 ? "" : "es"}</span>
      </div>

      <div className="overflow-auto flex-1">
        <div className="min-w-[720px]">
          <div className="grid items-center px-5 h-10 bg-[#f2f3f3] text-[12px] font-medium text-[#11111c] sticky top-0" style={{ gridTemplateColumns: cols }}>
            <span>Date</span><span>Staff Member</span><span>Event</span><span>Time</span><span>Source</span><span>Distance</span>
          </div>
          {loading && !item ? (
            <div className="py-12 text-center text-[14px] text-[#57575f]">Loading…</div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-[#57575f]">No punches in this period.</div>
          ) : events.map((e) => (
            <div key={e.id} className="grid items-center px-5 h-[44px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors text-[13px]" style={{ gridTemplateColumns: cols }}>
              <span className="text-[#57575f]">{prettyDate(e.date)}</span>
              <span className="font-medium text-[#11111c] truncate">{e.staffName}</span>
              <span>
                <span className={`inline-block text-[11px] px-[10px] py-[3px] rounded-full ${e.type === "in" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`}>
                  {e.type === "in" ? "Punch in" : "Punch out"}
                </span>
              </span>
              <span className="text-[#11111c]">{e.time}</span>
              <span className="text-[12px] text-[#57575f]">{e.method === "qr" ? "QR scan (attendance app)" : "Manual (HMS)"}</span>
              <span className="text-[12px] text-[#009598]">{e.distanceM != null ? `${e.distanceM} m` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Monthly register ─────────────────────────────────────────────────────────

function MonthlyView() {
  const thisMonth = todayIso().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { item, loading } = useItem<AttendanceSummaryDTO>(`/staff/attendance/summary?month=${month}`);
  const [selected, setSelected] = useState<AttendanceSummaryStaffDTO | null>(null);

  const days = item ? Array.from({ length: item.daysInMonth }, (_, i) => i + 1) : [];
  const gridCols = `minmax(170px,1.3fr) repeat(${days.length}, 26px) 64px 80px`;

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 mt-3 bg-[#f6f6f6] border-y border-[#dedee1] flex-wrap">
        <button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}
          className="w-[34px] h-[34px] rounded-[8px] bg-white border border-[#dedee1] flex items-center justify-center hover:border-[#009598] cursor-pointer">
          <ChevronLeft size={16} />
        </button>
        <span className="text-[14px] font-medium text-[#11111c] min-w-[130px] text-center">{monthLabel(month)}</span>
        <button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth}
          className="w-[34px] h-[34px] rounded-[8px] bg-white border border-[#dedee1] flex items-center justify-center hover:border-[#009598] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
          <ChevronRight size={16} />
        </button>
        <div className="flex items-center gap-3 ml-auto text-[11px] text-[#57575f]">
          {(["Present", "In progress", "No punch-out", "Absent", "On Leave"] as AttendanceDayStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-[5px]">
              <span className={`inline-block w-[14px] h-[14px] rounded-[3px] ${CELL_CLR[s]}`} />{s}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {loading && !item ? (
          <div className="py-12 text-center text-[14px] text-[#57575f]">Loading…</div>
        ) : !item || item.staff.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#57575f]">No staff to show.</div>
        ) : (
          <div style={{ minWidth: 170 + days.length * 26 + 144 + 40 }}>
            <div className="grid items-center px-5 h-9 bg-[#f2f3f3] text-[11px] font-medium text-[#11111c] sticky top-0 z-10" style={{ gridTemplateColumns: gridCols }}>
              <span>Staff Member</span>
              {days.map((d) => <span key={d} className="text-center">{d}</span>)}
              <span className="text-center">Days</span>
              <span className="text-center">Hours</span>
            </div>
            {item.staff.map((s) => (
              <button key={s.staffId} onClick={() => setSelected(s)}
                className="grid items-center px-5 h-[44px] w-full text-left border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors cursor-pointer"
                style={{ gridTemplateColumns: gridCols }}>
                <span className="min-w-0 pr-2">
                  <span className="block text-[13px] font-medium text-[#11111c] truncate">{s.name}</span>
                  <span className="block text-[10px] text-[#57575f] truncate">{s.role}</span>
                </span>
                {days.map((d) => {
                  const c = s.days[String(d)];
                  return (
                    <span key={d} className="flex items-center justify-center">
                      {c ? (
                        <span title={`${s.name} · ${d} ${monthLabel(month)} — ${c.status}`}
                          className={`w-[20px] h-[20px] rounded-[4px] text-[10px] font-medium flex items-center justify-center ${CELL_CLR[c.status]}`}>
                          {CELL_LABEL[c.status]}
                        </span>
                      ) : (
                        <span className="w-[20px] h-[20px]" />
                      )}
                    </span>
                  );
                })}
                <span className="text-[13px] font-medium text-[#00955c] text-center">{s.presentDays}</span>
                <span className="text-[12px] text-[#57575f] text-center">{s.totalMinutes > 0 ? `${Math.floor(s.totalMinutes / 60)}h` : "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <StaffDaysModal
        staff={selected}
        month={month}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function StaffDaysModal({
  staff, month, onClose,
}: { staff: AttendanceSummaryStaffDTO | null; month: string; onClose: () => void }) {
  const entries: [number, AttendanceDayCellDTO][] = staff
    ? Object.entries(staff.days)
        .map(([d, c]) => [Number(d), c] as [number, AttendanceDayCellDTO])
        .sort((a, b) => b[0] - a[0])
    : [];

  return (
    <Modal open={!!staff} onClose={onClose} title={staff ? `${staff.name} — ${monthLabel(month)}` : ""} width={640}>
      {staff && (
        <div>
          <div className="flex gap-6 mb-4 text-[13px]">
            <span><span className="text-[#57575f]">Present </span><b className="text-[#00955c]">{staff.presentDays}</b></span>
            <span><span className="text-[#57575f]">Absent </span><b className="text-[#ff0004]">{staff.absentDays}</b></span>
            <span><span className="text-[#57575f]">Hours </span><b>{hhmm(staff.totalMinutes)}</b></span>
          </div>
          <div className="border border-[#dedee1] rounded-[10px] overflow-hidden max-h-[420px] overflow-y-auto">
            <div className="grid items-center px-4 h-9 bg-[#f2f3f3] text-[12px] font-medium sticky top-0"
              style={{ gridTemplateColumns: "70px 110px 90px 90px 90px 1fr" }}>
              <span>Date</span><span>Status</span><span>In</span><span>Out</span><span>Hours</span><span>Source</span>
            </div>
            {entries.map(([d, c]) => (
              <div key={d} className="grid items-center px-4 h-[40px] border-t border-[#f0f0f0] text-[13px]"
                style={{ gridTemplateColumns: "70px 110px 90px 90px 90px 1fr" }}>
                <span>{d} {MONTH_NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3)}</span>
                <span><span className={`inline-block text-[11px] px-[8px] py-[2px] rounded-full ${STATUS_BADGE[c.status]}`}>{c.status}</span></span>
                <span>{c.punchIn || "—"}</span>
                <span>{c.punchOut || "—"}</span>
                <span className="text-[#57575f]">{hhmm(c.minutes)}</span>
                <span className="text-[11px] text-[#009598]">
                  {c.method === "qr"
                    ? `QR${c.inDistanceM != null ? ` · ${c.inDistanceM} m` : ""}${c.outDistanceM != null ? ` / ${c.outDistanceM} m` : ""}`
                    : c.method === "manual" ? "Manual" : ""}
                </span>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="py-8 text-center text-[13px] text-[#57575f]">No attendance days this month.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
