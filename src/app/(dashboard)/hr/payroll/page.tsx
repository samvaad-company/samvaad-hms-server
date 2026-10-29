"use client";

/** HR · Payroll: monthly runs and payslips, and each person's salary structure. Needs the "payroll" permission. */
import { Banknote } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { MrdShell, primaryBtn } from "@/components/mrd/shared";
import { RunsView, SalariesView } from "@/components/hr/PayrollViews";

const TABS = [
  { id: "runs", label: "Payroll runs" },
  { id: "salaries", label: "Salaries" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function PayrollPage() {
  const { can } = useAuth();
  const canWrite = can("payroll", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.hr.payroll.tab", IDS, "runs");
  const [running, setRunning] = useState(false);
  return (
    <MrdShell icon={<Banknote size={16} />} title="Payroll" note="Salaries, monthly runs and payslips" tabs={TABS} tab={tab} onTab={setTab}
      right={canWrite ? <button onClick={() => { setTab("runs"); setRunning(true); }} className={primaryBtn}>Run payroll</button> : undefined}>
      {tab === "runs" && <RunsView canWrite={canWrite} running={running} onRunClosed={() => setRunning(false)} />}
      {tab === "salaries" && <SalariesView canWrite={canWrite} />}
    </MrdShell>
  );
}
