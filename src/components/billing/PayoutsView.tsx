"use client";

/** Billing → Payouts: what the payout rules in Setup have earned doctors, referrers and outside labs, and who is still owed. */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { PayoutsDTO } from "@/types/api";
import { FormSelect } from "@/components/shared/FormRow";
import { ErrorNote, outlineBtn, Pill } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { formatDate } from "@/lib/dates";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ROLES = ["Consulting", "Surgeon", "Referred", "Outhouse"];
const TYPE_LABEL: Record<string, string> = { doctor: "Doctor", referral: "Referrer", centre: "Outside lab" };

export function PayoutsView({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState("Pending");
  const [role, setRole] = useState("");
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(role ? { role } : {}) }).toString();
  const { item: data, reload } = useItem<PayoutsDTO>(`/billing/payouts${query ? `?${query}` : ""}`);
  const { run, loading, error } = useMutation();

  async function pay(ids: number[]) {
    if (await attempt(run(() => api.post("/billing/payouts/pay", { ids })))) reload();
  }
  const pendingFor = (payee: string, type: string) => (data?.rows ?? []).filter(r => r.payee === payee && r.payeeType === type && r.status === "Pending").map(r => r.id);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="rounded-[10px] border border-[color:var(--line)] px-4 py-3"><p className="text-[12px] text-[color:var(--ink-soft)]">Owed (pending)</p><p className="text-[20px] font-medium">{inr(data?.totals.pending ?? 0)}</p></div>
        <div className="rounded-[10px] border border-[color:var(--line)] px-4 py-3"><p className="text-[12px] text-[color:var(--ink-soft)]">Paid out</p><p className="text-[20px] font-medium">{inr(data?.totals.paid ?? 0)}</p></div>
        <div className="ml-auto flex gap-3">
          <div className="w-[150px]"><FormSelect value={status} onChange={setStatus} options={[{ value: "", label: "All statuses" }, { value: "Pending", label: "Pending" }, { value: "Paid", label: "Paid" }, { value: "Void", label: "Void" }]} /></div>
          <div className="w-[150px]"><FormSelect value={role} onChange={setRole} options={[{ value: "", label: "All roles" }, ...ROLES.map(r => ({ value: r, label: r }))]} /></div>
        </div>
      </div>
      <ErrorNote message={error?.message} />

      <div>
        <h3 className="mb-2 text-[14px] font-medium">By payee</h3>
        <div className="divide-y divide-[color:var(--line)] rounded-[10px] border border-[color:var(--line)]">
          {(data?.payees ?? []).map(p => (
            <div key={`${p.payeeType}:${p.payee}`} className="flex items-center gap-3 px-4 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium">{p.payee}</span>
              <Pill tone="plain">{TYPE_LABEL[p.payeeType] ?? p.payeeType}</Pill>
              <span className="w-[110px] text-right text-[color:var(--ink-soft)]">{p.count} payout{p.count === 1 ? "" : "s"}</span>
              <span className="w-[130px] text-right">Owed {inr(p.pending)}</span>
              {canWrite && <button disabled={loading || pendingFor(p.payee, p.payeeType).length === 0} onClick={() => pay(pendingFor(p.payee, p.payeeType))} className={outlineBtn}>Mark paid</button>}
            </div>
          ))}
          {(data?.payees.length ?? 0) === 0 && <p className="px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">No payouts yet. They appear when an invoice is raised for a doctor, a referred patient or work sent outside.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[14px] font-medium">Payout lines</h3>
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-[color:var(--subtle)] text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">
              <tr>{["Bill", "Date", "Payee", "Rule", "On", "Amount", "Status"].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {(data?.rows ?? []).map(r => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-[12px]">{r.billNumber}</td>
                  <td className="px-3 py-2">{formatDate(r.date)}</td>
                  <td className="px-3 py-2">{r.payee}<span className="block text-[11px] text-[color:var(--ink-soft)]">{r.role}</span></td>
                  <td className="px-3 py-2">{r.rule}<span className="block text-[11px] text-[color:var(--ink-soft)]">{r.valueKind === "percent" ? `${r.value}%` : inr(r.value)}</span></td>
                  <td className="px-3 py-2">{inr(r.basis)}</td>
                  <td className="px-3 py-2 font-medium">{inr(r.amount)}</td>
                  <td className="px-3 py-2"><Pill tone={r.status === "Paid" ? "green" : r.status === "Pending" ? "amber" : "grey"}>{r.status}</Pill>{r.paidOn && <span className="block text-[11px] text-[color:var(--ink-soft)]">{formatDate(r.paidOn)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.rows.length ?? 0) === 0 && <p className="px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing matches.</p>}
        </div>
      </div>
    </div>
  );
}
