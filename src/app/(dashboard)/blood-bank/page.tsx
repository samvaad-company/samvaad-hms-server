"use client";

/**
 * Blood bank. Stock (ABO × Rh and every unit), Donors, Cross-match, Issues and the statutory Registers.
 * Writing needs the "bloodbank" permission (lab technicians and admins); everyone with read access can look.
 */
import { Droplet } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { StockView } from "@/components/bloodbank/StockView";
import { DonorsView } from "@/components/bloodbank/DonorsView";
import { CrossmatchView } from "@/components/bloodbank/CrossmatchView";
import { IssuesView } from "@/components/bloodbank/IssuesView";
import { RegistersView } from "@/components/bloodbank/RegistersView";

const TABS = ["stock", "donors", "crossmatch", "issues", "registers"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { stock: "Stock", donors: "Donors", crossmatch: "Cross-match", issues: "Issues", registers: "Registers" };

export default function BloodBankPage() {
  const { can } = useAuth();
  const canWrite = can("bloodbank", "write");
  const [tab, setTab] = useSavedChoice<Tab>("samvaad.bloodbank.tab", TABS, "stock");

  return (
    <div className={`${tw.gutterX} mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 flex-wrap border-b border-[color:var(--line)] px-5 py-3">
          <Droplet size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Blood bank</h1>
          <div role="tablist" aria-label="Blood bank" className="inline-flex p-[3px] rounded-[10px] bg-[color:var(--subtle)]">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`h-[30px] px-3 rounded-[8px] text-[14px] cursor-pointer transition-colors ${tab === t ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
                {LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        {tab === "stock" && <StockView canWrite={canWrite} />}
        {tab === "donors" && <DonorsView canWrite={canWrite} />}
        {tab === "crossmatch" && <CrossmatchView canWrite={canWrite} />}
        {tab === "issues" && <IssuesView canWrite={canWrite} />}
        {tab === "registers" && <RegistersView />}
      </div>
    </div>
  );
}
