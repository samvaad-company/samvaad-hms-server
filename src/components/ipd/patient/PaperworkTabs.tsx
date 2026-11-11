"use client";

/** Consents & forms, and TPA / insurance: the paperwork that goes with the stay. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { FileCheck2, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { ConsentDTO, IpdChecklistDTO, TpaClaimDTO } from "@/types/api";
import type { PreauthSummaryDTO } from "@/types/preauth";
import { CONSENT_FORMS, CONSENT_LANGUAGES } from "@/types/consent-catalog";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormSelect } from "@/components/shared/FormRow";
import { ChecklistDrawer } from "@/components/ipd/checklists/ChecklistDrawer";
import { StartChecklistDialog } from "@/components/ipd/checklists/StartChecklistDialog";
import { PayerDialog } from "@/components/ipd/patient/SummaryTab";
import { Card, ChartCtx, ErrorLine, LinkButton, Pill, btn, dateTime, done, inr } from "@/components/ipd/patient/ui";

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = { Signed: "ok", Waiting: "warn", Draft: "neutral", Refused: "bad", Cancelled: "neutral", Expired: "neutral" };

/** The forms a patient is asked to sign on admission, in the order the ward hands them over. */
const ON_ADMISSION = [
  { key: "admission-consent", label: "Admission form", note: "Patient and payer details, signed at admission" },
  { key: "general-consent", label: "Hospital rules undertaking", note: "The patient agrees to the hospital's rules and charges" },
  { key: "records-sharing-consent", label: "Self-declaration", note: "The patient confirms their history and details are right" },
];

export function NewConsentDialog({ ctx, open, onClose, onMade, only }: { ctx: ChartCtx; open: boolean; onClose: () => void; onMade: () => void; only?: string[] }) {
  const forms = CONSENT_FORMS.filter((f) => !only || only.includes(f.key));
  const [key, setKey] = useState(forms[0]?.key ?? "");
  const [language, setLanguage] = useState<string>("English");
  const { run, loading, error, reset } = useMutation();
  async function make() {
    if (!ctx.record.patientRefId) return;
    if (!(await done(run(() => api.post(`/patients/${ctx.record.patientRefId}/consents`, { template: key, language, includeEnglish: language !== "English" }))))) return;
    onMade();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New consent" subtitle="It opens in the patient's language, ready to be signed on a phone or on paper."
      footer={<><button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button><button onClick={make} disabled={loading || !key} className={`${btn.base} ${btn.solid}`}>{loading ? "Making…" : "Create consent"}</button></>}>
      <div className="flex flex-col gap-3">
        <FormRow label="Form"><FormSelect value={key} onChange={setKey} options={forms.map((f) => ({ value: f.key, label: f.title.English }))} /></FormRow>
        <FormRow label="Language"><FormSelect value={language} onChange={setLanguage} options={CONSENT_LANGUAGES.map((l) => ({ value: l, label: l }))} /></FormRow>
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

export function ConsentsTab({ ctx }: { ctx: ChartCtx }) {
  const pid = ctx.record.patientRefId;
  const { items: consents, reload } = useList<ConsentDTO>(pid ? `/patients/${pid}/consents` : null);
  const { items: allChecklists, reload: reloadLists } = useList<IpdChecklistDTO>("/ipd/checklists", { all: true });
  const checklists = allChecklists.filter((c) => c.admissionId === ctx.id);
  const [newOpen, setNewOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [openList, setOpenList] = useState<number | null>(null);
  const { run, loading, error } = useMutation();
  const byKey = useMemo(() => new Map(consents.map((c) => [c.templateKey, c])), [consents]);
  const editable = ctx.canWrite && !ctx.discharged;

  async function create(key: string) {
    if (!pid) return;
    if (await done(run(() => api.post(`/patients/${pid}/consents`, { template: key, language: "English", includeEnglish: false })))) { reload(); ctx.refresh(); }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <Card title="Consent forms" hint="Printed or sent to the phone in the patient's language" action={editable ? <button className={`${btn.base} ${btn.solid}`} onClick={() => setNewOpen(true)}><Plus size={13} /> New consent</button> : undefined}>
        {consents.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No consent made here yet. Use New consent — it opens in the patient&apos;s language.</p> : consents.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0">
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-[color:var(--ink)]">{c.formTitle}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{c.language} · made {dateTime(c.madeAt)} by {c.madeBy}</p></div>
            <Pill tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Pill>
          </div>
        ))}
        <div className="pt-2 text-right"><Link href="/signatures" className="text-[12px] text-[color:var(--brand)] hover:underline">Open all signatures →</Link></div>
      </Card>

      <Card title="Forms to sign on admission" hint="The usual papers — make each one here and have the patient or family sign">
        <ErrorLine error={error} />
        {ON_ADMISSION.map((f) => {
          const made = byKey.get(f.key);
          return (
            <div key={f.key} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0">
              <FileCheck2 size={15} className="text-[color:var(--ink-soft)]" />
              <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-[color:var(--ink)]">{f.label}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{f.note}</p></div>
              {made ? <Pill tone={STATUS_TONE[made.status] ?? "neutral"}>{made.status}</Pill> : editable ? <button disabled={loading} className={`${btn.base} ${btn.ghost}`} onClick={() => create(f.key)}>Create & send to sign</button> : <Pill>Not made</Pill>}
            </div>
          );
        })}
      </Card>

      <Card title="Checklists" hint="Pre-op, admission and discharge — tick them off, print them for the file" action={editable ? <button className={`${btn.base} ${btn.ghost}`} onClick={() => setStartOpen(true)}>Start checklist</button> : undefined}>
        {checklists.length === 0 ? <p className="py-3 text-center text-[13px] text-[color:var(--ink-soft)]">No checklist for this patient yet.</p> : checklists.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0">
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-[color:var(--ink)]">{c.name}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{c.done} of {c.total} ticked</p></div>
            <Pill tone={c.status === "Complete" ? "ok" : c.status === "Cancelled" ? "neutral" : "warn"}>{c.status}</Pill>
            <LinkButton onClick={() => setOpenList(c.id)}>Open</LinkButton>
          </div>
        ))}
      </Card>

      <Card title="Case file" hint="The hospital's admission, treatment and nursing sheets for this stay"><Link href={`/case-files/${ctx.id}`} className={`${btn.base} ${btn.ghost}`}>Open the case file</Link></Card>

      {newOpen && <NewConsentDialog ctx={ctx} open onClose={() => setNewOpen(false)} onMade={() => { reload(); ctx.refresh(); }} />}
      {startOpen && <StartChecklistDialog open onClose={() => setStartOpen(false)} onStarted={(c) => { setStartOpen(false); reloadLists(); setOpenList(c.id); }} />}
      {openList != null && <ChecklistDrawer id={openList} canWrite={ctx.canWrite} onClose={() => { setOpenList(null); reloadLists(); }} />}
    </div>
  );
}

export function InsuranceTab({ ctx }: { ctx: ChartCtx }) {
  const pid = ctx.record.patientRefId;
  const { items: forms } = useList<PreauthSummaryDTO>("/preauth", { all: true });
  const { items: claims } = useList<TpaClaimDTO>("/tpa/claims", { all: true });
  const [payerOpen, setPayerOpen] = useState(false);
  const mineForms = forms.filter((f) => f.patientId === pid);
  const mineClaims = claims.filter((c) => c.patientId === pid);
  const o = ctx.overview;
  const selfPay = !o || o.payer === "Self pay";

  return (
    <div className="flex flex-col gap-4 p-5">
      <Card title="Who is paying" action={ctx.canWrite && !ctx.discharged ? <LinkButton onClick={() => setPayerOpen(true)}>Change</LinkButton> : undefined}>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={selfPay ? "neutral" : "info"}>{o?.payer ?? "Self pay"}</Pill>
          {o && <span className="text-[13px] text-[color:var(--ink-soft)]">Billed {inr(o.stats.billed)} · deposit {inr(o.stats.deposit)} · balance due {inr(o.stats.balanceDue)}</span>}
        </div>
        {selfPay && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Self pay — no insurer on this admission. Change it if an insurer or TPA is paying, then start the pre-authorisation below.</p>}
      </Card>

      <Card title="Pre-authorisation forms" hint="The insurer's own form, filled in from this patient's record" action={<Link href="/preauth" className={`${btn.base} ${btn.solid}`}><Plus size={13} /> New pre-auth form</Link>}>
        {mineForms.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No pre-auth forms for this patient.</p> : mineForms.map((f) => (
          <Link key={f.id} href={`/preauth/${f.id}`} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0 hover:bg-[color:var(--faint)]">
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-[color:var(--ink)]">{f.formName}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{f.doctorName || "No doctor"} · updated {dateTime(f.updatedAt)}</p></div>
            <Pill tone={f.status === "Ready" ? "ok" : f.status === "Draft" ? "neutral" : "warn"}>{f.status}</Pill>
          </Link>
        ))}
      </Card>

      <Card title="Claims" hint="TPA / insurance claims raised for this patient" action={<Link href="/tpa" className={`${btn.base} ${btn.ghost}`}>Open TPA / Insurance</Link>}>
        {mineClaims.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No claims yet.</p> : mineClaims.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0">
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-[color:var(--ink)]">{c.tpaName || "TPA"} · {c.billNumber}</p><p className="text-[12px] text-[color:var(--ink-soft)]">Claimed {inr(c.claimAmount)} · approved {inr(c.approvedAmount)} · {c.date}</p></div>
            <Pill tone={c.status === "Approved" || c.status === "Settled" ? "ok" : c.status === "Rejected" ? "bad" : "warn"}>{c.status}</Pill>
          </div>
        ))}
      </Card>
      {payerOpen && <PayerDialog ctx={ctx} open onClose={() => setPayerOpen(false)} />}
    </div>
  );
}
