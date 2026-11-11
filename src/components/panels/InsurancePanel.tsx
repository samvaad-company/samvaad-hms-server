"use client";

/**
 * Insurance desk home panel: the pre-authorisation forms and TPA claims this desk looks after.
 */
import Link from "next/link";
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { TpaClaimDTO } from "@/types/api";
import type { PreauthSummaryDTO } from "@/types/preauth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileCheck2, ShieldCheck, Hourglass } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, WorklistCard, EmptyRow } from "./shared";
import { PatientName } from "@/components/loyalty/PatientName";

export function InsurancePanel() {
  const { user } = useAuth();
  const { items: forms } = useList<PreauthSummaryDTO>("/preauth", { all: true });
  const { items: claims } = useList<TpaClaimDTO>("/tpa/claims", { all: true });

  const drafts = forms.filter((f) => f.status === "Draft").length;
  const openClaims = claims.filter((c) => c.status !== "Approved" && c.status !== "Rejected" && c.status !== "Settled").length;
  const recent = [...forms].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  return (
    <>
      <PanelHeader name={user?.name ?? "Insurance"} subtitle="Insurance desk · Pre-auth and claims" badge="On Duty" />

      <StatRow stats={[
        { icon: FileCheck2, label: "Pre-auth Forms", value: String(forms.length), color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: Hourglass, label: "Drafts to Finish", value: String(drafts), color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: ShieldCheck, label: "Open Claims", value: String(openClaims), color: "text-[#00955c]", bg: "bg-[#dffff3]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <WorklistCard title="Recent pre-auth forms" action={{ label: "All pre-auth forms", href: "/preauth" }}>
          {recent.length === 0 ? (
            <EmptyRow text="No pre-auth forms yet." />
          ) : recent.map((f) => (
            <Link key={f.id} href={`/preauth/${f.id}`} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[color:var(--subtle-2)] hover:bg-[color:var(--faint)]">
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-medium text-[color:var(--ink)] truncate"><PatientName id={f.patientId} name={f.patientName} /></span>
                <span className="text-[11px] font-light text-[color:var(--ink-soft)] truncate">{f.formName}</span>
              </div>
              <StatusBadge status={f.status} />
            </Link>
          ))}
        </WorklistCard>
      </div>
    </>
  );
}
