"use client";

/**
 * Super Admin (and unknown-role fallback) home panel — hospital-wide overview
 * fed by the cross-module dashboard stats endpoint.
 */
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { AttendanceTodayDTO } from "@/types/api";
import Link from "next/link";
import { tw } from "@/lib/design-system";
import { MyTasksCard } from "./shared";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";

export function AdminPanel() {
  const { can } = useAuth();
  const { item: att } = useItem<AttendanceTodayDTO>(can("staff") ? "/staff/attendance/today" : null);

  return (
    <>
      <OverviewDashboard />

      {att && (
        <div className={`${tw.gutterX} mb-[30px]`}>
          <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-medium text-[color:var(--ink)]">Staff attendance today</h3>
                <p className="text-[12px] text-[color:var(--ink-soft)]">{att.present} of {att.totalStaff} checked in</p>
              </div>
              <Link href="/attendance" className="text-[13px] text-[color:var(--brand)] hover:underline">View all →</Link>
            </div>
            <div className="h-[8px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden mb-4">
              <div className="h-full bg-[#00955c]" style={{ width: `${att.totalStaff ? Math.round((att.present / att.totalStaff) * 100) : 0}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {[
                { l: "Present", v: att.present, c: "text-[#00955c]" },
                { l: "Checked out", v: att.checkedOut, c: "text-[color:var(--ink-soft)]" },
                { l: "Not in yet", v: att.notIn, c: "text-[#ff0004]" },
                { l: "On leave", v: att.onLeave, c: "text-[#ff9000]" },
                { l: "Via QR", v: att.viaQr, c: "text-[color:var(--brand)]" },
              ].map((s) => (
                <div key={s.l}>
                  <div className={`text-[20px] font-medium leading-none ${s.c}`}>{s.v}</div>
                  <div className="text-[11px] text-[color:var(--ink-soft)] mt-1">{s.l}</div>
                </div>
              ))}
            </div>
            {att.recent.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[color:var(--subtle-2)] text-[12px] text-[color:var(--ink-soft)] flex flex-wrap gap-x-5 gap-y-1">
                {att.recent.map((r) => (
                  <span key={`${r.staffId}-${r.punchIn}`}>
                    <b className="text-[color:var(--ink)] font-medium">{r.staffName}</b> · {r.punchIn}{r.method === "qr" ? " · QR" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={`${tw.gutterX} mb-[30px]`}>
        <MyTasksCard />
      </div>
    </>
  );
}
