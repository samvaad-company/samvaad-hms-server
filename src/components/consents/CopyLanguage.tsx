"use client";

/**
 * Choosing the language of a signed copy at the moment it is downloaded. The copy can be had in any language the form
 * has, whichever language it was made or signed in, with the English text added after it if wanted.
 */
import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { CONSENT_LANGUAGES, LANGUAGE_NAME, LANGUAGE_TAG, type ConsentLanguage } from "@/types/consent-catalog";
import type { ConsentDocumentDTO, ConsentDTO } from "@/types/api";
import { ErrorNote, cancelBtn, primaryBtn } from "@/components/mrd/shared";
import { useConsentPrinter } from "@/components/consents/ConsentDocument";

const asLanguage = (l: string | null | undefined, fallback: ConsentLanguage): ConsentLanguage => ((CONSENT_LANGUAGES as readonly string[]).includes(l ?? "") ? (l as ConsentLanguage) : fallback);

/** The language chips and the "also include English" box. */
export function CopyLanguageChoice({ available, value, onChange, english, onEnglish }: {
  available: ConsentLanguage[]; value: ConsentLanguage; onChange: (l: ConsentLanguage) => void; english: boolean; onEnglish: (v: boolean) => void;
}) {
  const canEnglish = value !== "English" && available.includes("English");
  return (
    <div>
      <div role="group" aria-label="Language of the copy" className="flex flex-wrap gap-2">
        {available.map((l) => (
          <button key={l} type="button" onClick={() => onChange(l)} aria-pressed={l === value}
            className={`h-[34px] rounded-full border px-4 text-[14px] cursor-pointer transition-colors ${l === value ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] font-medium text-[color:var(--ink)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>{LANGUAGE_NAME[l]}</button>
        ))}
      </div>
      {available.includes("English") && (
        <label className={`mt-3 flex items-center gap-2 text-[14px] ${canEnglish ? "cursor-pointer" : "opacity-50"}`}>
          <input type="checkbox" checked={canEnglish && english} disabled={!canEnglish} onChange={(e) => onEnglish(e.target.checked)} className="h-4 w-4 accent-[color:var(--brand)]" />
          Also include the English text after it
        </label>
      )}
    </div>
  );
}

/** Staff: "Signed copy" → pick the language → the copy opens in the print dialog (choose Save as PDF). */
export function SignedCopyDialog({ consent, onClose }: { consent: ConsentDTO; onClose: () => void }) {
  const { item: doc, error } = useItem<ConsentDocumentDTO>(`/consents/${consent.id}/document`);
  const printer = useConsentPrinter();
  const [picked, setPicked] = useState<ConsentLanguage | null>(null);
  const [english, setEnglish] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const available = doc ? CONSENT_LANGUAGES.filter((l) => doc.texts[l]) : [];
  const fallback = asLanguage(doc?.language, "English");
  const language = picked && available.includes(picked) ? picked : available.includes(asLanguage(doc?.signedLanguage, fallback)) ? asLanguage(doc?.signedLanguage, fallback) : fallback;
  const withEnglish = english ?? (doc?.includeEnglish ?? false);
  const title = doc?.texts[language]?.title ?? consent.formTitle;

  async function download() {
    setBusy(true); setFailed(null);
    try { await printer.print(() => api.get<ConsentDocumentDTO>(`/consents/${consent.id}/document`), title, { language, includeEnglish: language !== "English" && withEnglish }); }
    catch (e) { setFailed(e instanceof Error ? e.message : "The copy could not be prepared"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} width={460} title="Download signed copy" subtitle={`${consent.formTitle} · ${consent.patientName}`}
      footer={<><button onClick={onClose} className={cancelBtn}>Close</button><button onClick={download} disabled={!doc || busy} className={primaryBtn}><Download size={15} /> {busy ? "Preparing…" : "Download"}</button></>}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[14px] font-medium text-[color:var(--ink)]">Language of the copy</p>
          {doc ? <CopyLanguageChoice available={available} value={language} onChange={setPicked} english={withEnglish} onEnglish={setEnglish} /> : <p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p>}
        </div>
        {doc && <p lang={LANGUAGE_TAG[language]} className="rounded-[8px] bg-[color:var(--subtle)] px-3 py-2 text-[15px] font-medium text-[color:var(--ink)]">{title}</p>}
        <p className="text-[12px] text-[color:var(--ink-soft)]">The copy opens in your browser&apos;s print window — choose “Save as PDF”.</p>
        <ErrorNote message={failed ?? error?.message} />
      </div>
      {printer.node}
    </Modal>
  );
}
