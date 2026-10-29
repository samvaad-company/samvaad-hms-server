"use client";

/**
 * The page a patient opens from the link, QR code or tablet: read the form in Hindi, Gujarati or English (a switch at the
 * top changes every word on the page), say who is signing, sign with a finger, and send. No login — the long random token
 * in the link is the credential. A patient can also decline, and afterwards download their signed copy.
 */
import { use, useEffect, useRef, useState } from "react";
import { Building2, CheckCircle2, CircleAlert, Download, Eraser, FileText, Loader2, X } from "lucide-react";
import { useConsentPrinter } from "@/components/consents/ConsentDocument";
import { CopyLanguageChoice } from "@/components/consents/CopyLanguage";
import { CONSENT_LANGUAGES, LANGUAGE_NAME, LANGUAGE_TAG, RELATIONS, SIGN_STRINGS, type ConsentLanguage } from "@/types/consent-catalog";
import type { ConsentDocumentDTO, PublicConsentDTO } from "@/types/api";

/** Plain fetch — this page has no session, so it must not use the staff API client (which bounces 401s to login). */
async function call<T>(method: "GET" | "POST", path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/public/signatures${path}?token=${encodeURIComponent(token)}`, {
    method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  return json?.data as T;
}

const LOCALE: Record<ConsentLanguage, string> = { English: "en-IN", Hindi: "hi-IN", Gujarati: "gu-IN" };
const when = (iso: string | null, l: ConsentLanguage) =>
  iso ? new Date(iso).toLocaleString(LOCALE[l], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const asLanguage = (l: string): ConsentLanguage => ((CONSENT_LANGUAGES as readonly string[]).includes(l) ? (l as ConsentLanguage) : "English");

/** A drawing box: pointer events work for finger, pen and mouse. `onChange` gets a PNG once something is drawn, else null. */
function SignaturePad({ hint, clear, onChange }: { hint: string; clear: string; onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [inked, setInked] = useState(false);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current!.getContext("2d")!;
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const p = at(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1b1f4b";
    ctx.lineTo(p.x + 0.01, p.y + 0.01); ctx.stroke(); // a dot for a tap
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = at(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    if (!inked) setInked(true);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(ref.current!.toDataURL("image/png"));
    setInked(true);
  };
  const wipe = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setInked(false);
    onChange(null);
  };
  return (
    <div>
      <div className="relative">
        <canvas ref={ref} width={720} height={300} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          aria-label={hint} className="block h-[170px] w-full touch-none rounded-[10px] border border-dashed border-[#a8aab6] bg-white" />
        {!inked && <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[13px] text-[#6b6d7a]">{hint}</span>}
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={wipe} className="inline-flex items-center gap-1 text-[13px] text-[#6b6d7a] hover:text-[#11111c] cursor-pointer"><Eraser size={14} /> {clear}</button>
      </div>
    </div>
  );
}

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [form, setForm] = useState<PublicConsentDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lang, setLang] = useState<ConsentLanguage | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [relation, setRelation] = useState<string>("Self");
  const [agree, setAgree] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ kind: "Signed" | "Refused"; name: string; at: string | null } | null>(null);
  const [full, setFull] = useState(false);
  const [copyLang, setCopyLang] = useState<ConsentLanguage | null>(null);
  const [copyEnglish, setCopyEnglish] = useState(false);
  const printer = useConsentPrinter();

  useEffect(() => {
    let live = true;
    call<PublicConsentDTO>("GET", "", token)
      .then((f) => { if (live) setForm(f); })
      .catch((e) => { if (live) setLoadError(e instanceof Error ? e.message : "This link can’t be opened."); });
    return () => { live = false; };
  }, [token]);

  const formLang = form ? asLanguage(form.language) : "English";
  const L = lang ?? formLang;
  const t = SIGN_STRINGS[L];
  const text = form ? form.texts[L] ?? form.texts[formLang] ?? Object.values(form.texts)[0] : null;
  const available = form ? CONSENT_LANGUAGES.filter((l) => form.texts[l]) : [];
  const signerName = name ?? form?.signerName ?? form?.patientName ?? "";

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-[#f6f7f8]" lang={LANGUAGE_TAG[L]}>
      <header className="flex items-center justify-between gap-3 border-b border-[#e3e4e8] bg-white px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-[#11111c]"><Building2 size={18} className="shrink-0 text-[color:var(--brand)]" /><span className="truncate">{form?.hospitalName || "Hospital"}</span></span>
        {available.length > 1 && (
          <div role="group" aria-label="Language" className="inline-flex shrink-0 rounded-[8px] bg-[#f0f1f3] p-[2px]">
            {available.map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={L === l} className={`h-[28px] rounded-[6px] px-3 text-[13px] cursor-pointer ${L === l ? "bg-white font-medium text-[#11111c] shadow-sm" : "text-[#57575f]"}`}>{LANGUAGE_NAME[l]}</button>
            ))}
          </div>
        )}
      </header>
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 py-6">{children}</div>
    </main>
  );
  const card = (children: React.ReactNode, extra = "") => <section className={`rounded-[14px] border border-[#e3e4e8] bg-white p-4 ${extra}`}>{children}</section>;

  if (loadError) return shell(card(<div className="flex items-start gap-3"><CircleAlert className="mt-[2px] shrink-0 text-[#c8001a]" size={20} /><div><h1 className="text-[18px] font-semibold text-[#11111c]">{t.cantOpen}</h1><p className="mt-1 text-[14px] text-[#57575f]">{t.askNew}</p></div></div>));
  if (!form || !text) return shell(<div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#57575f]" /></div>);

  const title = card(
    <>
      <p className="text-[12px] text-[#57575f]">{t.pleaseRead}</p>
      <h1 className="mt-[2px] text-[20px] font-bold leading-[28px] text-[#11111c]">{text.title}</h1>
      <p className="mt-1 text-[14px] text-[#57575f]">{t.forName(form.patientName)}</p>
    </>,
  );

  // The signed copy can be had in any language the form has — by default the one the patient is reading in now.
  const copyLanguage = copyLang && available.includes(copyLang) ? copyLang : L;
  async function download() {
    try { await printer.print(() => call<ConsentDocumentDTO>("GET", "/copy", token), form!.texts[copyLanguage]?.title ?? text!.title, { language: copyLanguage, includeEnglish: copyLanguage !== "English" && copyEnglish }); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t open your copy"); }
  }

  // ── Already finished, or the link isn't live ──
  if (done?.kind === "Signed" || (!done && form.status === "Signed")) {
    const by = done?.name ?? form.signerName ?? form.patientName;
    return shell(<>{title}{card(
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-[#0b7a47]" size={30} />
        <p className="mt-2 text-[17px] font-semibold text-[#0b7a47]">{t.signedTitle}</p>
        <p className="mt-1 text-[14px] text-[#0b7a47]">{t.signedLine(by, when(done?.at ?? form.signedAt, L))}</p>
        {available.length > 1 && <div className="mt-4 flex justify-center text-left"><CopyLanguageChoice available={available} value={copyLanguage} onChange={setCopyLang} english={copyEnglish} onEnglish={setCopyEnglish} /></div>}
        <button onClick={download} className="mt-4 inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-[color:var(--brand)] px-5 text-[14px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer"><Download size={16} /> {t.download}</button>
        {error && <p role="alert" className="mt-3 text-[13px] text-[#c8001a]">{error}</p>}
      </div>, "!bg-[#e9fbf3] !border-[#b5ead2]")}{printer.node}</>);
  }
  if (done?.kind === "Refused" || form.status === "Refused") {
    return shell(<>{title}{card(<><p className="text-[16px] font-semibold text-[#11111c]">{t.declinedTitle}</p><p className="mt-1 text-[14px] text-[#57575f]">{done ? t.declinedLine : t.alreadyDeclined}</p></>)}</>);
  }
  if (form.status !== "Waiting") {
    return shell(<>{title}{card(<p className="text-[15px] text-[#11111c]">{form.status === "Expired" ? t.expired : t.cancelled}</p>)}</>);
  }

  async function submit(kind: "sign" | "refuse") {
    setBusy(true); setError(null);
    try {
      if (kind === "sign") {
        const r = await call<{ signedAt: string | null; signerName: string }>("POST", "/sign", token, { name: signerName.trim(), relation, agree, signature: png, language: L });
        setDone({ kind: "Signed", name: r.signerName, at: r.signedAt });
      } else {
        await call("POST", "/refuse", token, { reason: reason.trim() || undefined });
        setDone({ kind: "Refused", name: signerName, at: null });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  const ready = signerName.trim().length >= 2 && !!png && agree;
  const english = form.includeEnglish && L !== "English" ? form.texts.English : null;

  return shell(
    <>
      {title}
      {card(
        <>
          <h2 className="text-[15px] font-semibold text-[#11111c]">{t.step1}</h2>
          <div className="mt-3 rounded-[10px] border border-[#e3e4e8] bg-[#f7f8f9] p-3 text-[15px] leading-[25px] text-[#11111c]">{text.body}</div>
          <button onClick={() => setFull(true)} className="mt-3 flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#e3e4e8] text-[14px] text-[#11111c] hover:bg-[#f7f8f9] cursor-pointer"><FileText size={16} /> {t.openFull}</button>
        </>,
      )}
      {card(
        <>
          <h2 className="text-[15px] font-semibold text-[#11111c]">{t.step2}</h2>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <label className="flex flex-col gap-1 text-[13px] text-[#57575f]">{t.yourName}
              <input value={signerName} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-[42px] rounded-[8px] border border-[#e3e4e8] bg-white px-3 text-[15px] text-[#11111c] focus:border-[color:var(--brand)] focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-[#57575f]">{t.yourRelation}
              <select value={relation} onChange={(e) => setRelation(e.target.value)} className="h-[42px] rounded-[8px] border border-[#e3e4e8] bg-white px-2 text-[15px] text-[#11111c] focus:border-[color:var(--brand)] focus:outline-none">
                {RELATIONS.map((r) => <option key={r} value={r}>{t.relation[r]}</option>)}
              </select>
            </label>
          </div>
        </>,
      )}
      {card(
        <>
          <h2 className="text-[15px] font-semibold text-[#11111c]">{t.step3}</h2>
          <div className="mt-3"><SignaturePad hint={t.signHere} clear={t.clearSign} onChange={setPng} /></div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[14px] leading-[22px] text-[#11111c]"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-[4px] h-4 w-4 shrink-0 accent-[color:var(--brand)]" /> {t.agree}</label>
          {error && <p role="alert" className="mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[14px] text-[#c8001a]">{error}</p>}
          <button onClick={() => submit("sign")} disabled={busy || !ready} className="mt-4 h-[48px] w-full rounded-[10px] bg-[color:var(--brand)] text-[15px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">{busy ? t.submitting : t.submit}</button>
          {!png && <p className="mt-2 text-center text-[12px] text-[#6b6d7a]">{t.needSignature}</p>}
        </>,
      )}
      <div className="flex flex-col items-center gap-2 pb-6 text-center">
        {!declining ? (
          <button onClick={() => setDeclining(true)} className="text-[13px] text-[#57575f] underline cursor-pointer">{t.decline}</button>
        ) : (
          <div className="w-full rounded-[12px] border border-[#e3e4e8] bg-white p-3 text-left">
            <label className="flex flex-col gap-1 text-[13px] text-[#57575f]">{t.declineWhy}
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="h-[42px] rounded-[8px] border border-[#e3e4e8] px-3 text-[15px] text-[#11111c] focus:border-[color:var(--brand)] focus:outline-none" />
            </label>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setDeclining(false)} className="h-[40px] flex-1 rounded-[8px] border border-[#e3e4e8] text-[14px] cursor-pointer hover:bg-[#f7f8f9]">{t.declineBack}</button>
              <button onClick={() => submit("refuse")} disabled={busy} className="h-[40px] flex-1 rounded-[8px] bg-[#c8001a] text-[14px] font-medium text-white cursor-pointer hover:bg-[#a30015] disabled:opacity-50">{t.declineConfirm}</button>
            </div>
          </div>
        )}
        {form.expiresAt && <p className="text-[12px] text-[#6b6d7a]">{t.validUntil(when(form.expiresAt, L))}</p>}
      </div>

      {full && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={text.title} onClick={() => setFull(false)}>
          <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[18px] bg-white p-5 sm:rounded-[18px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[12px] text-[#57575f]">{form.hospitalName}</p><h2 className="text-[19px] font-bold text-[#11111c]">{text.title}</h2><p className="text-[13px] text-[#57575f]">{t.forName(form.patientName)}</p></div>
              <button onClick={() => setFull(false)} aria-label={t.closeFull} className="rounded-[8px] p-1 text-[#57575f] hover:bg-[#f0f1f3] cursor-pointer"><X size={20} /></button>
            </div>
            <p className="mt-4 text-[16px] leading-[27px] text-[#11111c]">{text.body}</p>
            {english && <div className="mt-4 border-t border-[#e3e4e8] pt-3"><p className="text-[13px] font-semibold text-[#11111c]">{english.title}</p><p lang="en" className="mt-1 text-[14px] leading-[22px] text-[#33343d]">{english.body}</p></div>}
            <button onClick={() => setFull(false)} className="mt-5 h-[44px] w-full rounded-[10px] bg-[color:var(--brand)] text-[14px] font-medium text-white cursor-pointer">{t.closeFull}</button>
          </div>
        </div>
      )}
    </>,
  );
}
