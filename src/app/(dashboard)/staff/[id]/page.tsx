"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useItem } from "@/lib/api/hooks";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { StaffDTO } from "@/types/api";
import { TabBar } from "@/components/shared/TabBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Phone, Mail, MapPin, Calendar, GraduationCap, Clock } from "lucide-react";

// ─── Mock extended data ───────────────────────────────────────────────────────

const STAFF_EXT: Record<number, { dob: string; address: string; education: string; shift: string; empId: string; emergencyContact: string }> = {
  1:  { dob: "12 Jun 1988", address: "45, Indiranagar, Bengaluru", education: "B.Sc Nursing, RGUHS", shift: "Morning (7 AM – 3 PM)", empId: "EMP-1001", emergencyContact: "+91 9988776655" },
  2:  { dob: "3 Feb 1992",  address: "78, Koramangala, Bengaluru", education: "B.Sc Med. Lab Technology", shift: "Morning (8 AM – 4 PM)", empId: "EMP-1002", emergencyContact: "+91 9988776656" },
  3:  { dob: "19 Nov 1995", address: "12, JP Nagar, Bengaluru", education: "B.Pharm, Rajiv Gandhi University", shift: "Rotational", empId: "EMP-1003", emergencyContact: "+91 9988776657" },
  4:  { dob: "7 Jul 1990",  address: "3, Malleshwaram, Bengaluru", education: "MBA Healthcare Admin", shift: "General (9 AM – 6 PM)", empId: "EMP-1004", emergencyContact: "+91 9988776658" },
  5:  { dob: "25 Mar 1993", address: "66, Whitefield, Bengaluru", education: "B.Sc Nursing, RGUHS", shift: "Evening (2 PM – 10 PM)", empId: "EMP-1005", emergencyContact: "+91 9988776659" },
  6:  { dob: "11 Oct 1987", address: "29, Rajajinagar, Bengaluru", education: "B.Com, Bangalore University", shift: "General (9 AM – 6 PM)", empId: "EMP-1006", emergencyContact: "+91 9988776660" },
  7:  { dob: "8 Aug 1991",  address: "55, HSR Layout, Bengaluru", education: "ITI Diploma", shift: "Morning (7 AM – 3 PM)", empId: "EMP-1007", emergencyContact: "+91 9988776661" },
  8:  { dob: "14 Jan 1989", address: "82, BTM Layout, Bengaluru", education: "B.Sc Nutrition & Dietetics", shift: "General (10 AM – 7 PM)", empId: "EMP-1008", emergencyContact: "+91 9988776662" },
  9:  { dob: "5 Sep 1985",  address: "14, Yeshwanthpur, Bengaluru", education: "12th + Security Training", shift: "Day (8 AM – 8 PM)", empId: "EMP-1009", emergencyContact: "+91 9988776663" },
  10: { dob: "22 Dec 1998", address: "37, Electronic City, Bengaluru", education: "10th + Housekeeping Diploma", shift: "Morning (6 AM – 2 PM)", empId: "EMP-1010", emergencyContact: "+91 9988776664" },
};

const MONTHLY_ATT = [
  { day: 1, status: "P" }, { day: 2, status: "P" }, { day: 3, status: "P" }, { day: 4, status: "P" },
  { day: 5, status: "P" }, { day: 6, status: "P" }, { day: 7, status: "A" }, { day: 8, status: "P" },
  { day: 9, status: "P" }, { day: 10, status: "P" }, { day: 11, status: "L" }, { day: 12, status: "L" },
  { day: 13, status: "P" }, { day: 14, status: "P" }, { day: 15, status: "P" }, { day: 16, status: "P" },
  { day: 17, status: "P" }, { day: 18, status: "P" }, { day: 19, status: "P" }, { day: 20, status: "P" },
  { day: 21, status: "P" }, { day: 22, status: "P" }, { day: 23, status: "P" }, { day: 24, status: "P" },
  { day: 25, status: "P" }, { day: 26, status: "A" }, { day: 27, status: "P" }, { day: 28, status: "P" },
  { day: 29, status: "P" }, { day: 30, status: "P" },
];

const ATT_CLR: Record<string, string> = {
  P: "bg-[#dffff3] text-[#00955c]",
  A: "bg-[#ffe9e9] text-[#ff0004]",
  L: "bg-[#fff2e0] text-[#ff9000]",
};

const TABS = [
  { id: "details",    label: "Details" },
  { id: "attendance", label: "Attendance" },
  { id: "performance",label: "Performance" },
];

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("details");
  const { item: staff, loading } = useItem<StaffDTO>(`/staff/${id}`);
  useBreadcrumb("/staff", "Staff", staff?.name ?? "Staff Profile");

  if (loading) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Loading…</p></div>;
  }
  if (!staff) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Staff member not found.</p></div>;
  }

  const ext = STAFF_EXT[staff.id] ?? STAFF_EXT[1];
  const present = MONTHLY_ATT.filter(d => d.status === "P").length;
  const absent  = MONTHLY_ATT.filter(d => d.status === "A").length;
  const leave   = MONTHLY_ATT.filter(d => d.status === "L").length;

  return (
    <>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          {/* Left: card */}
          <div className="flex flex-col gap-4 shrink-0" style={{ width: 280 }}>
            <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex flex-col items-center gap-3`}>
              <div className="w-16 h-16 rounded-full bg-[color:var(--subtle-2)] flex items-center justify-center text-[22px] font-medium text-[color:var(--ink-soft)]">
                {staff.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="text-center">
                <p className="text-[16px] font-medium text-[color:var(--ink)]">{staff.name}</p>
                <p className="text-[13px] font-light text-[color:var(--ink-soft)]">{staff.role}</p>
                <p className="text-[12px] font-light text-[color:var(--ink-soft)]">{ext.empId}</p>
              </div>
              <StatusBadge status={staff.status} />
            </div>

            <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex flex-col gap-3`}>
              {[
                { icon: Phone,         label: "Phone",      value: staff.phone },
                { icon: Mail,          label: "Email",      value: staff.email },
                { icon: MapPin,        label: "Address",    value: ext.address },
                { icon: Calendar,      label: "Date of Birth", value: ext.dob },
                { icon: GraduationCap, label: "Education",  value: ext.education },
                { icon: Clock,         label: "Shift",      value: ext.shift },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-3">
                  <row.icon size={13} className="text-[color:var(--ink-soft)] mt-[3px] shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[10px] font-normal text-[color:var(--ink-soft)] uppercase tracking-wider">{row.label}</p>
                    <p className="text-[12px] font-normal text-[color:var(--ink)] leading-[16px]">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: tabs */}
          <div className={`flex-1 ${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 500 }}>
            <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
            {tab === "details" && (
              <div className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Department",        value: staff.department },
                    { label: "Role",              value: staff.role },
                    { label: "Join Date",         value: staff.joinDate },
                    { label: "Employee ID",       value: ext.empId },
                    { label: "Shift",             value: ext.shift },
                    { label: "Emergency Contact", value: ext.emergencyContact },
                  ].map(f => (
                    <div key={f.label} className="p-4 border border-[color:var(--line)] rounded-[10px]">
                      <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-1">{f.label}</p>
                      <p className="text-[14px] font-normal text-[color:var(--ink)]">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === "attendance" && (
              <div className="p-5 flex flex-col gap-4">
                {/* Summary */}
                <div className="flex items-center gap-6">
                  {[{ l: "Present", v: present, c: "text-[#00955c]" }, { l: "Absent", v: absent, c: "text-[#ff0004]" }, { l: "On Leave", v: leave, c: "text-[#ff9000]" }].map(s => (
                    <div key={s.l} className="flex items-center gap-2">
                      <span className={`text-[22px] font-medium ${s.c}`}>{s.v}</span>
                      <span className="text-[12px] font-normal text-[color:var(--ink-soft)]">{s.l}</span>
                    </div>
                  ))}
                  <span className="text-[12px] font-normal text-[color:var(--ink-soft)] ml-auto">November 2025</span>
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-10 gap-1">
                  {MONTHLY_ATT.map(d => (
                    <div key={d.day} className={`flex flex-col items-center gap-[2px] p-2 rounded-[6px] ${ATT_CLR[d.status]}`}>
                      <span className="text-[10px] font-medium">{d.day}</span>
                      <span className="text-[9px] font-normal">{d.status}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  {[{ k: "P", l: "Present" }, { k: "A", l: "Absent" }, { k: "L", l: "Leave" }].map(s => (
                    <div key={s.k} className="flex items-center gap-1">
                      <span className={`w-3 h-3 rounded-[3px] ${ATT_CLR[s.k]}`} />
                      <span className="text-[11px] text-[color:var(--ink-soft)]">{s.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === "performance" && (
              <div className="p-5 grid grid-cols-2 gap-4">
                {[
                  { label: "Tasks Completed", value: "148", sub: "This month" },
                  { label: "Shift Adherence", value: "96%",  sub: "On-time check-ins" },
                  { label: "Patient Feedback", value: "4.7★", sub: "Average rating" },
                  { label: "Leave Taken",      value: `${leave} days`, sub: "November 2025" },
                  { label: "Training Completed", value: "3",  sub: "Modules this quarter" },
                  { label: "Overtime Hours",   value: "12 hrs", sub: "November 2025" },
                ].map(s => (
                  <div key={s.label} className="p-4 border border-[color:var(--line)] rounded-[10px] flex flex-col gap-1">
                    <p className="text-[12px] font-normal text-[color:var(--ink-soft)]">{s.label}</p>
                    <p className="text-[24px] font-medium text-[color:var(--ink)]">{s.value}</p>
                    <p className="text-[11px] font-light text-[color:var(--ink-soft)]">{s.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
