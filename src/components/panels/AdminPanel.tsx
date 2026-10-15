"use client";

/**
 * Super Admin (and unknown-role fallback) home panel — hospital-wide overview
 * fed by the cross-module dashboard stats endpoint.
 */
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { DashboardStatsDTO, AttendanceTodayDTO } from "@/types/api";
import {
  Users, Calendar, Clock, BedDouble, LayoutGrid, Receipt,
  Pill, FlaskConical, IndianRupee, Stethoscope, BarChart3, Settings2,
} from "lucide-react";
import Link from "next/link";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, MyTasksCard } from "./shared";

export function AdminPanel() {
  const { user, can } = useAuth();
  const { item: stats } = useItem<DashboardStatsDTO>("/dashboard");
  const { item: att } = useItem<AttendanceTodayDTO>(can("staff") ? "/staff/attendance/today" : null);

  const n = (v?: number) => String(v ?? 0);

  return (
    <>
      <PanelHeader name={user?.name ?? "Admin"} subtitle="Hospital Overview · Admin Panel" badge="All Systems Live" />

      <StatRow stats={[
        { icon: Users,       label: "Patients",           value: n(stats?.patients),          color: "text-[color:var(--ink)]", bg: "bg-[color:var(--subtle-2)]" },
        { icon: Calendar,    label: "Appointments Today", value: n(stats?.appointmentsToday), color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: Clock,       label: "OPD Waiting",        value: n(stats?.opdWaiting),        color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: BedDouble,   label: "IPD Admitted",       value: n(stats?.ipdAdmitted),       color: "text-[color:var(--brand)]", bg: "bg-[color:var(--brand-soft)]" },
        { icon: IndianRupee, label: "Revenue",            value: `₹${(stats?.revenue ?? 0).toLocaleString("en-IN")}`, color: "text-[#00955c]", bg: "bg-[#dffff3]" },
      ]} />

      <StatRow stats={[
        { icon: LayoutGrid,   label: "Beds Available", value: n(stats?.bedsAvailable), color: "text-[#00955c]", bg: "bg-[#dffff3]" },
        { icon: Receipt,      label: "Pending Bills",  value: n(stats?.pendingBills),  color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: Pill,         label: "Low Stock",      value: n(stats?.lowStock),      color: "text-[#ff0004]", bg: "bg-[#ffe9e9]" },
        { icon: FlaskConical, label: "Pending Labs",   value: n(stats?.pendingLabs),   color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
      ]} />

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
        <div className="max-w-[720px]">
          <QuickLinks links={[
            { href: "/reports",  label: "Reports",       description: "KPIs & performance",         icon: BarChart3 },
            { href: "/admin",    label: "Admin Panel",   description: "Settings, roles, users",      icon: Settings2 },
            { href: "/doctors",  label: "Doctors",       description: "Directory & schedules",       icon: Stethoscope },
            { href: "/billing",  label: "Billing",       description: "Invoices & collections",      icon: Receipt },
          ]} />
        </div>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        <MyTasksCard />
      </div>
    </>
  );
}
