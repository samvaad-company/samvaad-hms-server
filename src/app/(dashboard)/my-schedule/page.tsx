"use client";

import { CalendarClock } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { DoctorScheduleEditor } from "@/components/scheduling/DoctorScheduleEditor";

/** A doctor's own scheduling settings. */
export default function MySchedulePage() {
  const { user, loading } = useAuth();
  return (
    <>
      <div className={`${tw.gutterX} pt-[16px] mb-5 flex items-start gap-3`}>
        <div className="w-10 h-10 bg-[#f0f0f0] rounded-[10px] flex items-center justify-center shrink-0"><CalendarClock size={18} className="text-[#57575f]" /></div>
        <div>
          <h1 className="text-[26px] font-medium text-[#11111c] leading-8">My Schedule</h1>
          <p className="text-[14px] font-light text-[#57575f]">How many patients you see per hour, and your video-consultation hours.</p>
        </div>
      </div>
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          {loading ? (
            <div className="p-6 text-[14px] text-[#57575f]">Loading…</div>
          ) : user?.doctorId ? (
            <DoctorScheduleEditor doctorId={user.doctorId} canEdit />
          ) : (
            <div className="p-6 text-[14px] text-[#57575f]">This login isn&apos;t linked to a doctor profile, so there is no personal schedule to edit. An administrator can edit any doctor&apos;s schedule from the Doctors page.</div>
          )}
        </div>
      </div>
    </>
  );
}
