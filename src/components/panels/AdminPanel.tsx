"use client";

/**
 * Super Admin (and unknown-role fallback) home panel — hospital-wide overview
 * fed by the cross-module dashboard stats endpoint.
 */
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { DashboardStatsDTO } from "@/types/api";
import {
  Users, Calendar, Clock, BedDouble, LayoutGrid, Receipt,
  Pill, FlaskConical, IndianRupee, Stethoscope, BarChart3, Settings2,
} from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, MyTasksCard } from "./shared";

export function AdminPanel() {
  const { user } = useAuth();
  const { item: stats } = useItem<DashboardStatsDTO>("/dashboard");

  const n = (v?: number) => String(v ?? 0);

  return (
    <>
      <PanelHeader name={user?.name ?? "Admin"} subtitle="Hospital Overview · Admin Panel" badge="All Systems Live" />

      <StatRow stats={[
        { icon: Users,       label: "Patients",           value: n(stats?.patients),          color: "text-[#11111c]", bg: "bg-[#f0f0f0]" },
        { icon: Calendar,    label: "Appointments Today", value: n(stats?.appointmentsToday), color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: Clock,       label: "OPD Waiting",        value: n(stats?.opdWaiting),        color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: BedDouble,   label: "IPD Admitted",       value: n(stats?.ipdAdmitted),       color: "text-[#009598]", bg: "bg-[#e8f7f7]" },
        { icon: IndianRupee, label: "Revenue",            value: `₹${(stats?.revenue ?? 0).toLocaleString("en-IN")}`, color: "text-[#00955c]", bg: "bg-[#dffff3]" },
      ]} />

      <StatRow stats={[
        { icon: LayoutGrid,   label: "Beds Available", value: n(stats?.bedsAvailable), color: "text-[#00955c]", bg: "bg-[#dffff3]" },
        { icon: Receipt,      label: "Pending Bills",  value: n(stats?.pendingBills),  color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: Pill,         label: "Low Stock",      value: n(stats?.lowStock),      color: "text-[#ff0004]", bg: "bg-[#ffe9e9]" },
        { icon: FlaskConical, label: "Pending Labs",   value: n(stats?.pendingLabs),   color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
      ]} />

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
      <MyTasksCard />
    </>
  );
}
