"use client";

/**
 * Discharge: what must be settled first, the steps (summary, bill, leaving), the planned date and the discharge consents.
 * The patient can only leave once the final bill has been generated and every department the patient used (pharmacy, in-house lab
 * and radiology, blood bank, OT, ambulance) has been asked and has cleared them; a department that flags a pending bill is asked
 * again once the patient has paid.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api/client";
import { dischargeAdmission } from "@/lib/ipd-discharge";
import { useList, useMutation } from "@/lib/api/hooks";
import type { ConsentDTO, IpdClearanceDTO, IpdMedicationDTO } from "@/types/api";
import { FormInput, FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { NewConsentDialog } from "@/components/ipd/patient/PaperworkTabs";
import { Card, ChartCtx, ErrorLine, Notice, Pill, btn, dayShort, done, inr, inputCls } from "@/components/ipd/patient/ui";
import { todayIso } from "@/lib/dates";

const TYPES = ["Routine", "Transfer to another hospital", "Day care discharge"];
const OTHER_ENDINGS = [
  { label: "Leaving against advice", type: "Leaving against medical advice", consent: "lama-consent" },
  { label: "Patient died", type: "Patient died", consent: "" },
  { label: "Left without telling", type: "Left without telling", consent: "" },
];
const STEPS = ["Started", "Doctor's summary", "Bill cleared", "Patient left"];

function Check1({ ok, children, action }: { ok: boolean; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-[color:var(--line)] px-3 py-2 text-[13px]">
      {ok ? <Check size={15} className="shrink-0 text-[#0b7a47]" /> : <TriangleAlert size={15} className="shrink-0 text-[#c8001a]" />}
      <span className="flex-1 text-[color:var(--ink)]">{children}</span>
      {action}
    </div>
  );
}

export function DischargeTab({ ctx }: { ctx: ChartCtx }) {
  const o = ctx.overview;
  const pid = ctx.record.patientRefId;
  const { items: consents, reload: reloadConsents } = useList<ConsentDTO>(pid ? `/patients/${pid}/consents` : null);
  const { items: meds } = useList<IpdMedicationDTO>("/ipd/medications", { all: true, admission_id: ctx.id });
  const { items: clearances, reload: reloadClearances } = useList<IpdClearanceDTO>(`/ipd/${ctx.id}/clearances`);
  const { run, loading, error, reset } = useMutation();
  const [type, setType] = useState(TYPES[0]);
  const [planned, setPlanned] = useState(o?.plannedDischargeDate ?? "");
  const [form, setForm] = useState({ condition: "", summary: "", followUp: "" });
  const [consentOpen, setConsentOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const answering = !ctx.discharged && clearances.some((c) => c.status === "Pending");
  // While a department has not answered, look again every few seconds.
  useEffect(() => {
    if (!answering) return;
    const t = setInterval(reloadClearances, 6000);
    return () => clearInterval(t);
  }, [answering, reloadClearances]);

  if (!o) return <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading…</p>;
  const r = o.readiness;
  const notCleared = clearances.filter((c) => c.status !== "Cleared");
  const allCleared = notCleared.length === 0;
  const canLeave = r.finalBill && allCleared;
  const open = [!(r.ivRunning === 0), !(r.dosesPending === 0), !(r.balanceDue === 0), !r.admissionConsent, !r.finalBill, !allCleared].filter(Boolean).length;
  const stage = ctx.discharged ? 4 : o.dischargeStage === "Bill cleared" ? 3 : o.dischargeStage === "Doctor's summary" ? 2 : o.dischargeStage ? 1 : 0;
  const editable = ctx.canWrite && !ctx.discharged;
  const dischargeConsents = consents.filter((c) => /lama|refusal/i.test(c.templateKey));
  const activeMeds = meds.filter((m) => m.status === "Active");

  async function stay(body: Record<string, unknown>) {
    if (await done(run(() => api.patch(`/ipd/${ctx.id}/stay`, body)))) ctx.refresh();
  }
  async function start() {
    // Starting the discharge asks the doctor for the summary and the billing desk for the final bill, and tells every department the
    // patient used that they are about to go; the bed stays with the patient until they leave.
    if (!(await done(run(() => api.post(`/ipd/${ctx.id}/clearances`, {}))))) return;
    reloadClearances();
    await stay({ dischargeStage: "Doctor's summary" });
  }
  /** Ask the departments again: the ones that flagged a bill (once the patient has paid), or any the patient has used since. */
  async function askAgain(department?: string) {
    if (await done(run(() => api.post(`/ipd/${ctx.id}/clearances`, department ? { department } : {})))) reloadClearances();
  }
  async function writeSummary() {
    const content = [`DISCHARGE SUMMARY`, `Type: ${type}`, `Condition at discharge: ${form.condition || "—"}`, form.summary, form.followUp && `Follow-up: ${form.followUp}`].filter(Boolean).join("\n");
    if (!(await done(run(() => api.post("/ipd/notes", { admissionId: ctx.id, noteType: "Daily Note", content }))))) return;
    await stay({ dischargeStage: "Bill cleared" });
  }
  async function leave(note?: string) {
    if (note && !(await done(run(() => api.post("/ipd/notes", { admissionId: ctx.id, noteType: "Daily Note", content: `DISCHARGE — ${note}` }))))) return;
    if (await done(run(() => dischargeAdmission(ctx.id)))) ctx.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <Card title="Before the patient leaves" hint={ctx.discharged ? "Discharged" : open ? `${open} ${open === 1 ? "thing" : "things"} to finish` : "Everything is settled"}>
        <div className="grid gap-2 md:grid-cols-3">
          <Check1 ok={r.ivRunning === 0}>{r.ivRunning === 0 ? "No IV running" : `${r.ivRunning} IV running — stop or complete it`}</Check1>
          <Check1 ok={r.dosesPending === 0}>{r.dosesPending === 0 ? "No doses pending" : `${r.dosesPending} dose${r.dosesPending === 1 ? "" : "s"} due now`}</Check1>
          <Check1 ok={r.admissionConsent} action={!r.admissionConsent && editable ? <button className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline" onClick={() => ctx.go("consents")}>Make</button> : undefined}>{r.admissionConsent ? "Admission consent on file" : "There is no admission consent on file"}</Check1>
          <Check1 ok={r.unbilledDoses === 0} action={r.unbilledDoses ? <button className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline" onClick={() => ctx.go("medicines")}>Review</button> : undefined}>{r.unbilledDoses === 0 ? "No missed doses on the chart" : `${r.unbilledDoses} missed ${r.unbilledDoses === 1 ? "dose" : "doses"} with no record of being given`}</Check1>
          <Check1 ok={r.finalBill} action={!r.finalBill ? <Link href="/billing" className="text-[12px] text-[color:var(--brand)] hover:underline">Billing</Link> : undefined}>{r.finalBill ? "Final IPD bill generated" : "The final IPD bill has not been generated"}</Check1>
          <Check1 ok={allCleared && (clearances.length > 0 || stage > 0 || ctx.discharged)}>{clearances.length === 0 ? (stage > 0 || ctx.discharged ? "No department has anything to clear" : "Departments are asked when the discharge starts") : allCleared ? "Every department has cleared the patient" : `${notCleared.length} department${notCleared.length === 1 ? "" : "s"} yet to clear`}</Check1>
          <Check1 ok={r.balanceDue === 0} action={r.balanceDue ? <Link href="/billing" className="text-[12px] text-[color:var(--brand)] hover:underline">Billing</Link> : undefined}>{r.balanceDue === 0 ? "Nothing left to collect" : `${inr(r.balanceDue)} still to collect`}</Check1>
        </div>
      </Card>

      {(clearances.length > 0 || (stage > 0 && !ctx.discharged)) && (
        <Card title="Department clearance" hint="Each department the patient used is told the patient is about to be discharged and says whether a bill is still pending. The patient can leave only when all of them have cleared."
          action={editable && stage > 0 ? <button className={`${btn.base} ${btn.ghost}`} disabled={loading} onClick={() => askAgain()}>Ask any new departments</button> : undefined}>
          {clearances.length === 0 ? <p className="py-3 text-[13px] text-[color:var(--ink-soft)]">The patient has no entry in any department that needs to clear them.</p> : clearances.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] text-[13px] first:border-t-0">
              <span className="w-[150px] shrink-0 font-medium text-[color:var(--ink)]">{c.label}</span>
              <Pill tone={c.status === "Cleared" ? "ok" : c.status === "Flagged" ? "bad" : "warn"}>{c.status === "Pending" ? "Waiting for them" : c.status === "Flagged" ? "Pending bill" : "Cleared"}</Pill>
              <span className="min-w-0 flex-1 text-[12px] text-[color:var(--ink-soft)]">
                {c.status === "Flagged" ? `${c.amountDue > 0 ? `${inr(c.amountDue)} to pay` : "Payment pending"}${c.note ? ` — ${c.note}` : ""}${c.respondedBy ? ` · ${c.respondedBy}` : ""}` : c.status === "Cleared" ? `${c.respondedBy ? `by ${c.respondedBy}` : ""}${c.round > 1 ? ` · asked ${c.round} times` : ""}` : `Asked${c.round > 1 ? ` again (${c.round})` : ""} by ${c.requestedBy}`}
              </span>
              {c.status === "Flagged" && editable && <button className={`${btn.base} ${btn.solid}`} disabled={loading} onClick={() => askAgain(c.department)}>Patient has paid — ask again</button>}
            </div>
          ))}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`flex items-center gap-1 rounded-full border px-3 py-[3px] ${i < stage ? "border-[#b9e5cd] bg-[#e6f7ee] text-[#0b7a47]" : i === stage ? "border-[color:var(--brand)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink-soft)]"}`}>{i < stage && <Check size={11} />}{i + 1} · {s}</span>
            {i < STEPS.length - 1 && <span className="text-[color:var(--line)]">—</span>}
          </span>
        ))}
      </div>
      <ErrorLine error={error} />

      {ctx.discharged ? <Notice tone="ok">This patient has been discharged. The chart now waits in the MRD coding queue.</Notice> : stage === 0 ? (
        <Card title="Send the patient home" hint="Starting the discharge asks the doctor for the discharge summary and the billing desk for the final bill. The bed stays with the patient until they actually leave.">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[260px]"><FormRow label="Discharge type"><FormSelect value={type} onChange={setType} options={TYPES.map((t) => ({ value: t, label: t }))} /></FormRow></div>
            {editable && <button className={`${btn.base} ${btn.solid} h-[42px]`} disabled={loading} onClick={start}>Start discharge</button>}
            <div className="ml-auto flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[color:var(--ink-soft)]">Other endings</span>
              {OTHER_ENDINGS.map((e) => <button key={e.label} disabled={!editable || loading} className={`${btn.base} ${btn.ghost}`} onClick={() => { if (confirm(`${e.label}: this ends the stay and frees the bed. Continue?`)) void leave(e.type); }}>{e.label}</button>)}
            </div>
          </div>
        </Card>
      ) : stage === 1 ? (
        <Card title="Doctor's discharge summary" hint="Written by the treating doctor; kept on the chart.">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormRow label="Condition at discharge"><FormInput value={form.condition} onChange={set("condition")} placeholder="Stable / Improved" /></FormRow>
              <FormRow label="Follow-up advice"><FormInput value={form.followUp} onChange={set("followUp")} placeholder="Review after 7 days with reports" /></FormRow>
            </div>
            <FormRow label="Summary" required><FormTextarea value={form.summary} onChange={set("summary")} rows={5} placeholder="Course in hospital, procedures, medicines on discharge…" /></FormRow>
            {editable && <div className="flex justify-end"><button className={`${btn.base} ${btn.solid}`} disabled={loading || !form.summary.trim()} onClick={writeSummary}>Save summary</button></div>}
          </div>
        </Card>
      ) : (
        <Card title="Ready for the patient to leave" hint="The summary is written. Once the bill is cleared the patient can go; the bed then goes to housekeeping.">
          {r.balanceDue > 0 && <Notice tone="warn">{inr(r.balanceDue)} is still to collect. Settle it at billing — or, with billing access, discharge anyway and give a reason.</Notice>}
          {!r.finalBill && <Notice tone="warn">The final IPD bill has not been generated. Raise it in Billing before the patient can be discharged.</Notice>}
          {r.finalBill && !allCleared && <Notice tone="warn">Discharge is not happening yet: {notCleared.map((c) => c.status === "Flagged" ? `${c.label} has a bill pending${c.amountDue > 0 ? ` (${inr(c.amountDue)})` : ""}` : `${c.label} has not answered`).join("; ")}.</Notice>}
          {editable && <div className="mt-3"><button className={`${btn.base} ${btn.solid}`} disabled={loading || r.ivRunning > 0 || !canLeave} onClick={() => leave()}>Patient has left — discharge</button>{r.ivRunning > 0 && <span className="ml-3 text-[12px] text-[#b3001b]">Stop the IV first.</span>}</div>}
        </Card>
      )}

      <Card title="Discharge consents" hint="Leaving against medical advice, or the hospital's own going-home forms — in the patient's language" action={editable ? <button className={`${btn.base} ${btn.solid}`} onClick={() => setConsentOpen(true)}>New consent</button> : undefined}>
        {dischargeConsents.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No consent made here yet. Use New consent — it opens in the patient&apos;s language.</p> : dischargeConsents.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[8px] text-[13px] first:border-t-0"><span className="flex-1">{c.formTitle}</span><Pill tone={c.status === "Signed" ? "ok" : "warn"}>{c.status}</Pill></div>
        ))}
      </Card>

      <Card title="Planned discharge date" hint="Plan the discharge a day or two ahead: each department — pharmacy returns, billing, the summary — gets its own task, so nothing is left for the last minute.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[200px]"><FormRow label="Date"><input type="date" value={planned} min={todayIso()} disabled={!editable} onChange={(e) => { reset(); setPlanned(e.target.value); }} className={`${inputCls} !h-[42px]`} /></FormRow></div>
          {editable && <button className={`${btn.base} ${btn.ghost} h-[42px]`} disabled={loading || planned === (o.plannedDischargeDate ?? "")} onClick={() => stay({ plannedDischargeDate: planned || null })}>{planned ? "Plan the discharge" : "Clear the date"}</button>}
          {o.plannedDischargeDate && <Pill tone="info">Planned for {dayShort(o.plannedDischargeDate)}</Pill>}
        </div>
      </Card>

      <section className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <button type="button" onClick={() => setHomeOpen((v) => !v)} aria-expanded={homeOpen} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-[13px] font-semibold text-[color:var(--ink)]">
          <ChevronDown size={14} className={`transition-transform ${homeOpen ? "rotate-180" : "-rotate-90"}`} /> Medicines to go home with <span className="text-[12px] font-normal text-[color:var(--ink-soft)]">{activeMeds.length ? `${activeMeds.length} on the chart now` : "Not started"}</span>
        </button>
        {homeOpen && (
          <div className="border-t border-[color:var(--subtle-2)] px-4 py-3">
            {activeMeds.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No active medicines.</p> : <ul className="list-disc pl-5 text-[13px] text-[color:var(--ink)]">{activeMeds.map((m) => <li key={m.id}>{m.medicineName} {[m.dosage, m.route, m.frequency].filter(Boolean).join(" · ")}</li>)}</ul>}
            <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">The doctor lists what to continue at home in the discharge summary.</p>
          </div>
        )}
      </section>

      {consentOpen && <NewConsentDialog ctx={ctx} open only={["lama-consent", "refusal-consent", "general-consent"]} onClose={() => setConsentOpen(false)} onMade={() => { reloadConsents(); ctx.refresh(); }} />}
    </div>
  );
}
