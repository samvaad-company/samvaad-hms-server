"use client";

/**
 * A consent as a page: the hospital letterhead, the form in the patient's language (and the English text after it, if
 * asked), who it is for, and the signature block. Printed blank it is the form to sign on paper; once signed it is the
 * signed copy, with the drawn signature, who signed, their relation and when. Rendered off-screen and handed to the
 * print dialog (choose Save as PDF there), and used for the "open the full document" view on the patient's phone.
 */
import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { DocumentLetterhead, type HospitalSettings } from "@/components/shared/DocumentLetterhead";
import { printElement } from "@/lib/print";
import { CONSENT_LANGUAGES, LANGUAGE_TAG, SIGN_STRINGS, type ConsentLanguage, type Relation } from "@/types/consent-catalog";
import type { ConsentDocumentDTO } from "@/types/api";

const asLanguage = (l: string): ConsentLanguage => (CONSENT_LANGUAGES as readonly string[]).includes(l) ? (l as ConsentLanguage) : "English";

const dateOf = (iso: string | null | undefined, lang: ConsentLanguage) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "Hindi" ? "hi-IN" : lang === "Gujarati" ? "gu-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const letterhead = (h: ConsentDocumentDTO["hospital"]): HospitalSettings => ({
  name: h.name, address: h.address, city: "", state: "", pincode: "", phone: h.phone, email: h.email, website: "", gstNumber: h.gstNumber, regNumber: "",
});

export function ConsentDocument({ doc }: { doc: ConsentDocumentDTO }) {
  const lang = asLanguage(doc.language);
  const t = SIGN_STRINGS[lang];
  const text = doc.texts[lang] ?? Object.values(doc.texts)[0];
  const english = doc.includeEnglish && lang !== "English" ? doc.texts.English : null;
  const signer = doc.signerName || doc.patient.name;
  const relation = doc.signerRelation ? t.relation[doc.signerRelation as Relation] ?? doc.signerRelation : t.relation.Self;
  const gender = doc.patient.gender === "Male" ? t.male : doc.patient.gender === "Female" ? t.female : doc.patient.gender ? t.other : "";
  const meta: [string, string][] = [
    [t.patient, doc.patient.name],
    ["UHID", doc.patient.code || "—"],
    [t.ageSex, [doc.patient.age != null ? `${doc.patient.age}y` : "", gender].filter(Boolean).join(" / ") || "—"],
    [t.date, dateOf(doc.signedAt ?? doc.madeAt, lang)],
  ];
  return (
    <div className="bg-white text-black" style={{ width: 720, fontFamily: "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', system-ui, sans-serif" }}>
      <DocumentLetterhead hospital={letterhead(doc.hospital)} compact />
      <div className="px-8 pb-10 pt-5">
        <h1 lang={LANGUAGE_TAG[lang]} className="text-center text-[20px] font-bold leading-[30px]">{text.title}</h1>
        <dl className="mt-4 grid gap-4" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}>
          {meta.map(([k, v]) => (
            <div key={k}><dt className="text-[10px] text-[#666]">{k}</dt><dd className="mt-[2px] text-[13px]">{v}</dd></div>
          ))}
        </dl>
        <p lang={LANGUAGE_TAG[lang]} className="mt-6 text-[14px] leading-[26px]">{text.body}</p>
        {english && (
          <div className="mt-5 border-t border-[#ddd] pt-4">
            <p className="text-[12px] font-semibold">{english.title}</p>
            <p lang="en" className="mt-1 text-[12px] leading-[20px] text-[#222]">{english.body}</p>
          </div>
        )}
        <div className="mt-16 grid gap-10" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="flex h-[64px] items-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {doc.signatureData && <img src={doc.signatureData} alt="" className="max-h-[60px] max-w-full object-contain" />}
            </div>
            <div className="border-t border-black pt-1">
              <p className="text-[12px]">{signer}</p>
              <p className="text-[11px] text-[#444]">{t.relationLabel} {relation}</p>
              {doc.signedAt && <p className="mt-1 text-[10px] text-[#444]">{t.signedOn(dateOf(doc.signedAt, lang) + ", " + new Date(doc.signedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }))}{doc.signedVia === "paper" ? " (paper)" : ""}</p>}
            </div>
          </div>
          <div>
            <div className="h-[64px]" />
            <div className="border-t border-black pt-1">
              <p className="text-[12px]">{t.witness}</p>
              {doc.witnessName && <p className="text-[11px] text-[#444]">{doc.witnessName}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Print a consent: fetch it, render it off-screen, and open the print dialog. Put `node` somewhere in the page. */
export interface PrintOptions {
  /** Print it in this language instead of the one the form was made in. */
  language?: string;
  includeEnglish?: boolean;
}

export function useConsentPrinter(): { print: (load: () => Promise<ConsentDocumentDTO>, title: string, options?: PrintOptions) => Promise<void>; node: ReactNode } {
  const ref = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<ConsentDocumentDTO | null>(null);
  const print = async (load: () => Promise<ConsentDocumentDTO>, title: string, options?: PrintOptions) => {
    const loaded = await load();
    const d = options ? { ...loaded, ...(options.language ? { language: options.language } : {}), ...(options.includeEnglish != null ? { includeEnglish: options.includeEnglish } : {}) } : loaded;
    // Render now (not on the next frame) so there is something in the DOM to print.
    flushSync(() => setDoc(d));
    printElement(ref.current?.firstElementChild as HTMLElement | null, title);
  };
  const node = <div ref={ref} aria-hidden style={{ position: "absolute", left: -99999, top: 0 }}>{doc && <ConsentDocument doc={doc} />}</div>;
  return { print, node };
}
