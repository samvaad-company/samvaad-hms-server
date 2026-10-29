"use client";

/** HR · Shifts & roster: the weekly grid, who is on duty on a day, and the shift definitions. Writing needs "hr". */
import { CalendarRange } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { MrdShell } from "@/components/mrd/shared";
import { DutyListView, RosterView, ShiftsView, useShifts } from "@/components/hr/RosterViews";

const TABS = [
  { id: "roster", label: "Weekly roster" },
  { id: "duty", label: "Duty list" },
  { id: "shifts", label: "Shifts" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function RosterPage() {
  const { can } = useAuth();
  const canWrite = can("hr", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.hr.roster.tab", IDS, "roster");
  const { items: shifts, reload } = useShifts();
  return (
    <MrdShell icon={<CalendarRange size={16} />} title="Shifts & roster" note="Who works which shift, day by day" tabs={TABS} tab={tab} onTab={setTab}>
      {tab === "roster" && <RosterView canWrite={canWrite} shifts={shifts} />}
      {tab === "duty" && <DutyListView shifts={shifts} />}
      {tab === "shifts" && <ShiftsView canWrite={canWrite} shifts={shifts} reload={reload} />}
    </MrdShell>
  );
}
