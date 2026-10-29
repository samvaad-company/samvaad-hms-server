"use client";

/**
 * One consent in a list, with everything staff can do to it at its stage:
 *   Not signed yet  → Print · Signed on paper · Send to sign on phone (· delete)
 *   Sent / Opened   → Show QR / resend · Cancel link
 *   Signed          → Signed copy (the scan, if it was signed on paper and scanned)
 *   Declined / link cancelled or expired → Send to sign on phone again
 */
import { useState } from "react";
import { Pencil, Printer, Smartphone, Trash2, QrCode } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { LANGUAGE_NAME, type ConsentLanguage } from "@/types/consent-catalog";
import type { ConsentDocumentDTO, ConsentDTO, ConsentStage } from "@/types/api";
import { attempt, ErrorNote, outlineBtn } from "@/components/mrd/shared";
import { useConsentPrinter } from "@/components/consents/ConsentDocument";
import { PaperDialog } from "@/components/consents/PaperDialog";
import { ReadyDialog, SendDialog } from "@/components/consents/SendDialogs";
import { SignedCopyDialog } from "@/components/consents/CopyLanguage";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "13 Oct, 5:12 pm" */
export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours() % 12 || 12;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
}

const STAGE_TONE: Record<ConsentStage, string> = {
  "Not signed yet": "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  "Sent to phone": "bg-[#e3efff] text-[#0a5fc4] border-[#b9d3ff]",
  "Opened on phone": "bg-[#e3efff] text-[#0a5fc4] border-[#b9d3ff]",
  "Signed on phone": "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  "Signed on paper": "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  Declined: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  "Link cancelled": "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
  "Link expired": "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
};

export function StageChip({ stage }: { stage: ConsentStage }) {
  return <span className={`inline-flex items-center rounded-full border px-[10px] py-[1px] text-[12px] leading-[18px] whitespace-nowrap ${STAGE_TONE[stage]}`}>{stage === "Signed on phone" || stage === "Signed on paper" ? `✓ ${stage}` : stage}</span>;
}

const sendBtn = "inline-flex items-center gap-[6px] rounded-[8px] border border-[color:var(--brand)] bg-[color:var(--surface)] px-3 h-[30px] text-[13px] font-medium text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)] cursor-pointer";

export function ConsentRow({ consent: c, canWrite, showPatient, onChanged }: { consent: ConsentDTO; canWrite: boolean; showPatient?: boolean; onChanged?: () => void }) {
  const [dialog, setDialog] = useState<"send" | "ready" | "paper" | "copy" | null>(null);
  const [live, setLive] = useState<ConsentDTO | null>(null); // the consent with its fresh link, between creating it and closing
  const { run, error, reset } = useMutation();
  const printer = useConsentPrinter();
  const lang = (c.language in LANGUAGE_NAME ? c.language : "English") as ConsentLanguage;

  const printForm = () => printer.print(() => api.get<ConsentDocumentDTO>(`/consents/${c.id}/document`), c.formTitle);
  const act = async (fn: () => Promise<unknown>) => { reset(); if (await attempt(run(fn))) onChanged?.(); };

  const signed = c.status === "Signed";
  const detail = signed
    ? `Signed by ${c.signerName ?? c.patientName}${c.signerRelation ? ` (${c.signerRelation})` : ""} · ${when(c.signedAt)}`
    : c.status === "Waiting" ? `${c.stage === "Opened on phone" ? "Opened" : "Sent"} ${when(c.openedAt ?? c.linkSentAt)} · works until ${when(c.expiresAt)}`
    : c.status === "Refused" ? `Declined ${c.refusedReason ? `— “${c.refusedReason}”` : ""}`
    : `Made ${when(c.madeAt)}`;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p lang={lang === "Hindi" ? "hi" : lang === "Gujarati" ? "gu" : "en"} className="text-[15px] font-medium text-[color:var(--ink)]">{c.formTitle}</p>
          <p className="mt-[2px] text-[13px] text-[color:var(--ink-soft)]">{showPatient ? `${c.patientName} · ` : ""}{LANGUAGE_NAME[lang]} · {detail}</p>
        </div>
        <StageChip stage={c.stage} />
        {canWrite && (c.status === "Draft" || c.status === "Cancelled" || c.status === "Expired" || c.status === "Refused") && (
          <>
            <button onClick={printForm} className={outlineBtn} title="Print to sign on paper"><Printer size={14} /> Print</button>
            {c.status !== "Refused" && <button onClick={() => { reset(); setDialog("paper"); }} className={outlineBtn}><Pencil size={14} /> Signed on paper</button>}
          </>
        )}
        {signed && (
          c.signedVia === "paper" && c.signedDocumentId
            ? <a href={`/api/documents/${c.signedDocumentId}/download`} target="_blank" rel="noreferrer" className={outlineBtn} title="Download the scanned signed form"><Printer size={14} /> Signed copy</a>
            : <button onClick={() => setDialog("copy")} className={outlineBtn} title="Download the signed form in the language you choose"><Printer size={14} /> Signed copy</button>
        )}
      </div>
      {canWrite && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(c.status === "Draft" || c.status === "Cancelled" || c.status === "Expired") && (
            <button onClick={() => { reset(); setDialog("send"); }} className={sendBtn}><Smartphone size={14} /> Send to sign on phone</button>
          )}
          {c.status === "Waiting" && (
            <>
              <button onClick={() => { setLive(c); setDialog("ready"); }} className={outlineBtn}><QrCode size={14} /> Show QR / resend</button>
              <button onClick={() => act(() => api.post(`/consents/${c.id}/cancel`))} className="h-[30px] px-2 text-[13px] font-medium text-[#c8001a] hover:underline cursor-pointer">Cancel link</button>
            </>
          )}
          {c.status === "Draft" && (
            <button onClick={() => act(() => api.del(`/consents/${c.id}`))} aria-label={`Delete ${c.formTitle}`} title="Delete this form" className="ml-auto grid h-[30px] w-[30px] place-items-center rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={15} /></button>
          )}
        </div>
      )}
      <div className="mt-2"><ErrorNote message={error?.message} /></div>
      {printer.node}
      {dialog === "send" && <SendDialog consent={c} onClose={() => setDialog(null)} onCreated={(made) => { setLive(made); setDialog(made.delivery === "device" ? null : "ready"); onChanged?.(); }} />}
      {dialog === "ready" && (live ?? c).link && <ReadyDialog consent={live ?? c} onClose={() => { setDialog(null); setLive(null); }} />}
      {dialog === "copy" && <SignedCopyDialog consent={c} onClose={() => setDialog(null)} />}
      {dialog === "paper" && <PaperDialog consent={c} onClose={() => setDialog(null)} onDone={() => onChanged?.()} />}
    </div>
  );
}
