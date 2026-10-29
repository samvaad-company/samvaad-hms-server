"use client";

/**
 * MRD coding. The coding queue (discharged charts waiting for ICD-10 codes and a sign-off), the birth and death
 * registers, and a dashboard. Writing needs the "mrd" permission.
 */
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { MrdShell } from "@/components/mrd/shared";
import { CodingDashboardView, CodingQueueView } from "@/components/mrd/CodingViews";
import { RegistersView } from "@/components/mrd/RegistersView";

const TABS = [
  { id: "queue", label: "Coding queue" },
  { id: "registers", label: "Registers" },
  { id: "dashboard", label: "Dashboard" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const IDS = TABS.map((t) => t.id) as readonly Tab[];

export default function MrdCodingPage() {
  const { can } = useAuth();
  const canWrite = can("mrd", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.mrd.coding.tab", IDS, "queue");
  return (
    <MrdShell icon={<ClipboardCheck size={16} />} title="MRD coding" tabs={TABS} tab={tab} onTab={setTab}>
      {tab === "queue" && <CodingQueueView canWrite={canWrite} />}
      {tab === "registers" && <RegistersView canWrite={canWrite} />}
      {tab === "dashboard" && <CodingDashboardView />}
    </MrdShell>
  );
}
