"use client";

/**
 * The "Consent forms" card on a patient's Documents & consents tab: every consent made for them, newest first, and
 * "New consent". While any link is out, the list refreshes every few seconds and a notice appears the moment one is signed.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSignature, Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList } from "@/lib/api/hooks";
import { LANGUAGE_NAME } from "@/types/consent-catalog";
import type { ConsentDTO } from "@/types/api";
import { primaryBtn } from "@/components/mrd/shared";
import { NewConsentDrawer, patientLanguage, type ConsentPatient } from "@/components/consents/NewConsentDrawer";
import { ConsentRow } from "@/components/consents/ConsentRow";
import { useConsentPrinter } from "@/components/consents/ConsentDocument";
import type { ConsentDocumentDTO } from "@/types/api";
import { ReadyDialog, SendDialog } from "@/components/consents/SendDialogs";

const POLL_MS = 5000;

export function ConsentsPanel({ patient, canWrite }: { patient: ConsentPatient; canWrite: boolean }) {
  const { items, reload } = useList<ConsentDTO>(`/patients/${patient.id}/consents`);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ConsentDTO | null>(null); // a consent just made, offered for sending
  const [sending, setSending] = useState<"send" | "ready" | null>(null);
  const printer = useConsentPrinter();
  const known = useRef<Map<number, string>>(new Map());
  const anyOut = items.some((c) => c.status === "Waiting");

  // Remember each consent's status, so the poll can tell when one turns Signed.
  useEffect(() => { known.current = new Map(items.map((c) => [c.id, c.status])); }, [items]);

  useEffect(() => {
    if (!anyOut) return;
    const timer = setInterval(async () => {
      try {
        const next = await api.get<ConsentDTO[]>(`/patients/${patient.id}/consents`);
        const done = next.find((c) => c.status === "Signed" && known.current.get(c.id) === "Waiting");
        if (done) setToast(`${patient.name}: ${done.formTitle} is signed — signed by ${done.signerName ?? patient.name}${done.signerRelation ? ` (${done.signerRelation})` : ""} on their phone.`);
        if (next.some((c) => known.current.get(c.id) !== c.status)) reload();
      } catch { /* the next tick tries again */ }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [anyOut, patient.id, patient.name, reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const theirs = patientLanguage(patient.language);

  return (
    <section className="rounded-[14px] border border-[color:var(--line)] bg-[color:var(--surface)]">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[color:var(--subtle)] text-[color:var(--ink-soft)]"><FileSignature size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold text-[color:var(--ink)]">Consent forms</h3>
          <p className="text-[13px] text-[color:var(--ink-soft)]">Printed or sent to the phone in the patient&apos;s language ({LANGUAGE_NAME[theirs]}).</p>
        </div>
        {canWrite && <button onClick={() => setDrawer(true)} className={primaryBtn}><Plus size={15} /> New consent</button>}
      </div>
      {items.length > 0 && (
        <div className="mx-5 mb-5 divide-y divide-[color:var(--line)] rounded-[10px] border border-[color:var(--line)]">
          {items.map((c) => <ConsentRow key={c.id} consent={c} canWrite={canWrite} onChanged={reload} />)}
        </div>
      )}
      {items.length === 0 && <p className="px-5 pb-5 text-[14px] text-[color:var(--ink-soft)]">No consent forms yet.</p>}

      {drawer && (
        <NewConsentDrawer patient={patient} onClose={() => setDrawer(false)}
          onMade={(c, andPrint) => {
            setDrawer(false); reload();
            if (andPrint) void printer.print(() => api.get<ConsentDocumentDTO>(`/consents/${c.id}/document`), c.formTitle);
            else { setFresh(c); setSending("send"); }
          }} />
      )}
      {fresh && sending === "send" && <SendDialog consent={fresh} onClose={() => { setFresh(null); setSending(null); }} onCreated={(c) => { setFresh(c); setSending(c.delivery === "device" ? null : "ready"); reload(); }} />}
      {fresh && sending === "ready" && fresh.link && <ReadyDialog consent={fresh} onClose={() => { setFresh(null); setSending(null); }} />}
      {printer.node}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-[60] flex max-w-[360px] items-start gap-3 rounded-[12px] border border-[#9fe3c6] bg-white p-4 shadow-xl">
          <CheckCircle2 size={20} className="mt-[1px] shrink-0 text-[#0b7a47]" />
          <p className="text-[14px] text-[color:var(--ink)]">{toast}</p>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-[color:var(--ink-soft)] cursor-pointer"><X size={15} /></button>
        </div>
      )}
    </section>
  );
}
