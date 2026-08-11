"use client";

/**
 * Billing Exec home panel — collections view: pending/partial bills worklist
 * and revenue snapshot.
 */
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { BillDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Receipt, IndianRupee, Clock, Wallet, ShieldCheck } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, WorklistCard, EmptyRow, MyTasksCard } from "./shared";

export function BillingPanel() {
  const { user } = useAuth();
  const { items: bills } = useList<BillDTO>("/billing", { all: true });

  const open = bills.filter(b => b.status === "Pending" || b.status === "Partial");
  const revenue = bills
    .filter(b => b.status === "Paid" || b.status === "Partial")
    .reduce((s, b) => s + b.total, 0);
  const outstanding = open.reduce((s, b) => s + b.total, 0);

  return (
    <>
      <PanelHeader name={user?.name ?? "Billing"} subtitle="Collections · Billing Panel" badge="Billing Desk" />

      <StatRow stats={[
        { icon: Clock,       label: "Open Bills",      value: String(open.length),                            color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: IndianRupee, label: "Outstanding",     value: `₹${outstanding.toLocaleString("en-IN")}`,      color: "text-[#ff0004]", bg: "bg-[#ffe9e9]" },
        { icon: Wallet,      label: "Collected",       value: `₹${revenue.toLocaleString("en-IN")}`,          color: "text-[#00955c]", bg: "bg-[#dffff3]" },
        { icon: Receipt,     label: "Total Bills",     value: String(bills.length),                           color: "text-[#11111c]", bg: "bg-[#f0f0f0]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          <WorklistCard title="Bills Awaiting Payment" action={{ label: "All bills", href: "/billing" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
              {open.length === 0 ? (
                <EmptyRow text="No open bills." />
              ) : open.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0] hover:bg-[#fafafa]">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#009598] truncate">{b.billNumber}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{b.patientName} · {b.type} · {b.date}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] font-medium text-[#11111c]">₹{b.total.toLocaleString("en-IN")}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          </WorklistCard>

          <div className="flex flex-col gap-4 shrink-0" style={{ width: 380 }}>
            <QuickLinks links={[
              { href: "/billing",  label: "New Bill",         description: "Generate an invoice",         icon: Receipt },
              { href: "/billing",  label: "Bill Lookup",      description: "Find bills by patient",       icon: Wallet },
              { href: "/tpa",      label: "TPA Claims",       description: "Insurance claim tracking",    icon: ShieldCheck },
              { href: "/finance",  label: "Income & Expense", description: "Non-clinical bookkeeping",    icon: IndianRupee },
            ]} />
          </div>
        </div>
      </div>
      <MyTasksCard />
    </>
  );
}
