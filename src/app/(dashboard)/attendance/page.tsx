"use client";

import { CalendarCheck, UserCheck, UserX, Users2 } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceBoard } from "@/components/attendance/AttendanceBoard";
import type { AttendanceTodayDTO } from "@/types/api";

export default function AttendancePage() {
  const { can } = useAuth();
  const { item: today } = useItem<AttendanceTodayDTO>("/staff/attendance/today");

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Daily check-in status and the monthly register for every staff member."
        stats={[
          { icon: UserCheck, value: `${today?.present ?? 0}`, label: "Present Today" },
          { icon: UserX, value: `${today?.notIn ?? 0}`, label: "Not In Yet" },
          { icon: CalendarCheck, value: `${today?.onLeave ?? 0}`, label: "On Leave" },
          { icon: Users2, value: `${today?.totalStaff ?? 0}`, label: "Total Staff" },
        ]}
        dateRange={false}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          <AttendanceBoard canWrite={can("staff", "write")} height={640} />
        </div>
      </div>
    </>
  );
}
