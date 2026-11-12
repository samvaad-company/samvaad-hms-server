"use client";

/** Setup → Masters → Billing remarks: the note printed on IPD bills above a limit — whether it is used, the limit and the wording. */
import { useAuth } from "@/lib/auth-context";
import { ConfigCard } from "@/components/setup/ConfigCard";
import { useConfig, type FieldSpec } from "@/components/setup/ui";

const ROWS: FieldSpec[][] = [
  [{ key: "ipdRemarkLimit", label: "Show the remark when the IPD bill is above (₹)", type: "number", hint: "Compared with the bill total." }],
  [{ key: "ipdRemarkText", label: "Remark text", type: "textarea", rows: 3, hint: "Printed at the bottom of the bill. It can still be changed on an individual bill before it is saved." }],
];
const CHIPS: FieldSpec[] = [{ key: "ipdRemarkEnabled", label: "Add the remark to large IPD bills", type: "toggle" }];

export function BillingRemarksView() {
  const { can } = useAuth();
  const { item: billing, reload } = useConfig("billing");
  if (!billing) return <p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <ConfigCard title="IPD bill remark" configKey="billing" rows={ROWS} chips={CHIPS} values={billing} canEdit={can("admin", "write")} onSaved={reload}
      note="When an IPD bill's total is above the limit, this remark is filled in on the new bill and printed on it." />
  );
}
