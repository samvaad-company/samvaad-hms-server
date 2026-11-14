"use client";

/**
 * Discharge clearance: when IPD starts a patient's discharge, every department the patient used (pharmacy, in-house lab and
 * radiology, blood bank, OT, ambulance) lands here. A department either clears the patient or flags a bill that is still to be
 * paid; the patient must pay it and IPD then asks again. The discharge only goes through when every department has cleared.
 */
import { useEffect, useState } from "react";
import { BedDouble, ClipboardCheck, Clock, TriangleAlert } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormInput } from "@/components/shared/FormRow";
import type { IpdClearanceDTO, IpdClearanceInboxDTO } from "@/types/api";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const btn = "inline-flex h-[32px] items-center rounded-full px-4 text-[13px] cursor-pointer disabled:opacity-50";

function Request({ c, onDone }: { c: IpdClearanceDTO; onDone: () => void }) {
  const [flagging, setFlagging] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { run, loading, error } = useMutation();
  const answer = async (body: Record<string, unknown>) => {
    try { await run(() => api.post(`/ipd/clearances/${c.id}`, body)); setFlagging(false); onDone(); } catch { /* the message shows under the buttons */ }
  };
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[14px] font-medium text-[color:var(--ink)]">{c.patientName}</p>
        <span className="rounded-full bg-[color:var(--subtle)] px-2 py-[1px] text-[11px] text-[color:var(--ink-soft)]">{c.label}</span>
        {c.round > 1 && <span className="rounded-full bg-[#e3efff] px-2 py-[1px] text-[11px] text-[#0a5fc4]">Asked again - the patient has paid</span>}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-[color:var(--ink-soft)]">
        {c.admissionNo && <span>{c.admissionNo}</span>}
        {(c.bed || c.ward) && <span className="inline-flex items-center gap-1"><BedDouble size={12} /> {[c.ward, c.bed].filter(Boolean).join(" · ")}</span>}
        <span>Asked by {c.requestedBy}</span>
      </p>
      {c.unpaidBills > 0 && <p className="flex items-center gap-2 rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[12px] text-[#8a5300]"><TriangleAlert size={14} /> {money(c.unpaidBills)} is unpaid on {c.label.toLowerCase()} bills for this patient.</p>}
      {flagging ? (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <FormInput type="number" placeholder="₹ pending amount" value={amount} onChange={setAmount} min="0" />
            <FormInput placeholder="What is pending? e.g. Medicines issued on 12 Nov, bill PH-0042" value={note} onChange={setNote} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} bg-[#c8001a] text-white`} disabled={loading || (!Number(amount) && !note.trim())} onClick={() => answer({ decision: "Flagged", amountDue: Number(amount) || 0, note })}>Flag pending bill</button>
            <button className={`${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)]`} onClick={() => setFlagging(false)}>Back</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`} disabled={loading} onClick={() => answer({ decision: "Cleared" })}>No pending bill - clear</button>
          <button className={`${btn} border border-[#c8001a] text-[#c8001a]`} disabled={loading} onClick={() => setFlagging(true)}>Pending bill - patient must pay</button>
        </div>
      )}
      {error && <p className="text-[12px] text-[#c8001a]">{error.message}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3"><div><h2 className="text-[15px] font-medium text-[color:var(--ink)]">{title}</h2><p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p></div>{children}</section>;
}

export default function ClearancesPage() {
  const { item, reload } = useItem<IpdClearanceInboxDTO>("/ipd/clearances");
  // New requests arrive while the page is open.
  useEffect(() => { const t = setInterval(reload, 8000); return () => clearInterval(t); }, [reload]);
  const waiting = item?.waiting ?? [], flagged = item?.flagged ?? [], answered = item?.answered ?? [];

  return (
    <>
      <PageHeader title="Discharge clearance" subtitle="Patients about to be discharged: confirm there is no pending bill in your department." stats={[{ icon: Clock, value: String(waiting.length), label: "Waiting for you" }, { icon: ClipboardCheck, value: String(flagged.length), label: "Pending bills" }]} />
      <div className={`${tw.gutterX} mb-8 flex flex-col gap-6`}>
        <Section title="Waiting for your answer" hint="Clear the patient, or flag the bill they still have to pay.">
          {!item ? <p className="text-[13px] text-[color:var(--ink-soft)]">Loading…</p> : waiting.length === 0 ? <p className="rounded-[10px] border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing is waiting for your department.</p> : waiting.map((c) => <Request key={c.id} c={c} onDone={reload} />)}
        </Section>
        {flagged.length > 0 && (
          <Section title="Pending bills you flagged" hint="Waiting for the patient to pay. IPD will ask again once they have; it will then show up above.">
            {flagged.map((c) => (
              <div key={c.id} className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-3 p-4 text-[13px]`}>
                <span className="font-medium text-[color:var(--ink)]">{c.patientName}</span>
                <span className="rounded-full bg-[color:var(--subtle)] px-2 py-[1px] text-[11px] text-[color:var(--ink-soft)]">{c.label}</span>
                <span className="text-[#c8001a]">{c.amountDue > 0 ? `${money(c.amountDue)} pending` : "Payment pending"}</span>
                {c.note && <span className="text-[12px] text-[color:var(--ink-soft)]">{c.note}</span>}
              </div>
            ))}
          </Section>
        )}
        {answered.length > 0 && (
          <Section title="Recently cleared" hint="Your last answers.">
            <div className={`${tw.surface.card} ${tw.radius.card} divide-y divide-[color:var(--subtle-2)]`}>
              {answered.map((c) => <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-[13px]"><span className="font-medium text-[color:var(--ink)]">{c.patientName}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{c.label} · cleared by {c.respondedBy}</span></div>)}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
