"use client";

/** HR · Leave: requests to approve, yearly balances, who is away this month, and the leave types. Writing needs "hr". */
import { CalendarOff } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { useList } from "@/lib/api/hooks";
import type { HrLeaveTypeDTO } from "@/types/api";
import { MrdShell, primaryBtn } from "@/components/mrd/shared";
import { BalancesView, CalendarView, LeaveTypesView, RequestsView } from "@/components/hr/LeaveViews";
import { ApplyLeaveDialog } from "@/components/hr/HrDialogs";

const TABS = [
  { id: "requests", label: "Requests" },
  { id: "balances", label: "Balances" },
  { id: "calendar", label: "Calendar" },
  { id: "types", label: "Leave types" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function LeavePage() {
  const { can } = useAuth();
  const canWrite = can("hr", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.hr.leave.tab", IDS, "requests");
  const { items: types } = useList<HrLeaveTypeDTO>("/hr/leave-types");
  const [applying, setApplying] = useState(false);
  return (
    <>
      <MrdShell icon={<CalendarOff size={16} />} title="Leave" note="Apply, approve and track staff leave" tabs={TABS} tab={tab} onTab={setTab}
        right={canWrite ? <button onClick={() => setApplying(true)} className={primaryBtn}>+ Apply for leave</button> : undefined}>
        {tab === "requests" && <RequestsView canWrite={canWrite} />}
        {tab === "balances" && <BalancesView />}
        {tab === "calendar" && <CalendarView />}
        {tab === "types" && <LeaveTypesView canWrite={canWrite} />}
      </MrdShell>
      {applying && <ApplyLeaveDialog types={types} onClose={() => setApplying(false)} />}
    </>
  );
}
