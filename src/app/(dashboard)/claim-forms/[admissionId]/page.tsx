"use client";

/** One claim form: the insurer's own form, filled from the patient's record (Part A for the insured, Part B for the hospital), ready to download. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Printer, RotateCcw } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem } from "@/lib/api/hooks";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { PatientName } from "@/components/loyalty/PatientName";
import { ALL_CLAIM_FORMS } from "@/lib/claims/forms";
import { buildClaimPdf, loadClaimTemplate } from "@/lib/claims/build";
import { CLAIM_FIELDS, CLAIM_GROUPS } from "@/lib/claims/fields";
import { downloadBlob, printBlob } from "@/lib/preauth/exact";
import type { ClaimDraftDTO, ClaimValues } from "@/types/claims";
import type { ClaimTemplate } from "@/lib/claims/claim-fill";

const input = "h-[38px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none";

export default function ClaimFormPage() {
  const { admissionId } = useParams<{ admissionId: string }>();
  const { item: draft, loading, error } = useItem<ClaimDraftDTO>(`/claim-forms/${admissionId}`);
  useBreadcrumb("/claim-forms", "Claim forms", draft ? draft.candidate.patientName : "Claim form");
  if (error) return <p className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>{error.message}</p>;
  if (loading || !draft) return <p className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>Loading…</p>;
  return <ClaimEditor key={draft.candidate.admissionId} draft={draft} />;
}

function ClaimEditor({ draft }: { draft: ClaimDraftDTO }) {
  const [formKey, setFormKey] = useState(draft.candidate.formKey ?? "");
  const [values, setValues] = useState<ClaimValues>(draft.values);
  const [loaded, setLoaded] = useState<{ key: string; tpl: ClaimTemplate } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef<string | null>(null);
  const tpl = loaded && loaded.key === formKey ? loaded.tpl : null;

  const def = useMemo(() => ALL_CLAIM_FORMS.find((f) => f.key === formKey) ?? null, [formKey]);
  const options = useMemo(() => ALL_CLAIM_FORMS.map((f) => ({ value: f.key, label: f.name, hint: f.kind })), []);

  useEffect(() => {
    if (!formKey) return;
    let dead = false;
    loadClaimTemplate(formKey).then((t) => { if (!dead) setLoaded({ key: formKey, tpl: t }); }).catch(() => {});
    return () => { dead = true; };
  }, [formKey]);

  /** The PDF follows the details as they are typed. */
  useEffect(() => {
    if (!formKey || !def) return;
    let dead = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const blob = await buildClaimPdf(formKey, { formName: def.name, patientName: draft.candidate.patientName }, values);
        if (dead) return;
        const u = URL.createObjectURL(blob);
        if (last.current) URL.revokeObjectURL(last.current);
        last.current = u; setUrl(u); setPdfError("");
      } catch (e) { if (!dead) { setUrl(null); setPdfError(e instanceof Error ? e.message : "Couldn't prepare the form."); } }
      finally { if (!dead) setBusy(false); }
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [formKey, def, draft.candidate.patientName, values]);
  useEffect(() => () => { if (last.current) URL.revokeObjectURL(last.current); }, []);

  const c = draft.candidate;
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const fileName = `Claim form - ${c.patientName} - ${def?.name ?? "insurer"}.pdf`;
  const btn = "inline-flex h-[34px] items-center gap-2 rounded-full px-4 text-[13px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";
  const primary = `${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`;
  const ghost = `${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]`;

  return (
    <div className={`${tw.gutterX} mb-[30px] flex flex-col gap-4 pt-5`}>
      <div className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-3 p-4`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium text-[color:var(--ink)]"><PatientName id={c.patientId} name={c.patientName} /></p>
          <p className="truncate text-[12px] text-[color:var(--ink-soft)]">
            {[c.admissionNo, [c.ward, c.bed].filter(Boolean).join(" · "), c.admissionDate ? `Admitted ${formatDate(c.admissionDate)}` : "", c.doctor ? `Dr. ${c.doctor.replace(/^Dr\.?\s*/i, "")}` : ""].filter(Boolean).join(" · ")}
          </p>
          <p className="truncate text-[12px] text-[color:var(--ink-soft)]">Paid by {c.payer}{c.policyNo ? ` · Policy ${c.policyNo}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={!url} onClick={() => url && fetch(url).then((r) => r.blob()).then((b) => printBlob(b))} className={ghost}><Printer size={14} /> Print</button>
          <button disabled={!url} onClick={() => url && fetch(url).then((r) => r.blob()).then((b) => downloadBlob(b, fileName))} className={primary}><Download size={14} /> Download PDF</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,440px)_1fr]">
        <div className="flex flex-col gap-4">
          <div className={`${tw.surface.card} ${tw.radius.card} p-4`}>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Insurance company / TPA&apos;s claim form</p>
            <SearchSelect placeholder="Choose the insurer's form…" value={formKey} onChange={setFormKey} options={options} />
            {c.formKey === "generic" && formKey === "generic" && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">“{c.payer}” has no form of its own here, so the standard claim form is used. Pick another to use an insurer's own.</p>}
            {!c.formKey && !formKey && <p className="mt-2 text-[12px] text-[#b26a00]">“{c.payer}” isn&apos;t one of the insurers whose form is here. Pick the form to use.</p>}
            {tpl && tpl.partB === false && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">This insurer&apos;s form has the insured&apos;s part only; the hospital&apos;s details are not printed on it.</p>}
            <button onClick={() => { setValues(draft.values); setFormKey(c.formKey ?? ""); }} className="mt-3 inline-flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] underline cursor-pointer"><RotateCcw size={12} /> Reset to the patient&apos;s record</button>
          </div>

          {CLAIM_GROUPS.map((g) => {
            const keys = Object.keys(CLAIM_FIELDS).filter((k) => CLAIM_FIELDS[k].group === g.key);
            return (
              <div key={g.key} className={`${tw.surface.card} ${tw.radius.card} p-4`}>
                <p className="text-[14px] font-medium text-[color:var(--ink)]">{g.title}</p>
                <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">{g.note}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {keys.map((k) => {
                    const f = CLAIM_FIELDS[k];
                    const wide = f.type === "longtext";
                    return (
                      <label key={k} className={`flex flex-col gap-[5px] ${wide ? "sm:col-span-2" : ""}`}>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{f.label}</span>
                        {f.type === "gender" || f.type === "choice" ? (
                          <select value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={input}>
                            <option value="">—</option>
                            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : wide ? (
                          <textarea rows={2} value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={`${input} h-auto resize-none py-2`} />
                        ) : (
                          <input value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={f.type === "date" ? "DD/MM/YYYY" : f.type === "time" ? "HH:MM" : ""} className={input} />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          {!formKey ? (
            <div className={`${tw.surface.card} ${tw.radius.card} flex min-h-[320px] items-center justify-center p-6 text-center text-[14px] text-[color:var(--ink-soft)]`}>Choose the insurer&apos;s form to see it filled in.</div>
          ) : pdfError ? (
            <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{pdfError}</p>
          ) : !url ? (
            <p className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">Preparing the claim form…</p>
          ) : (
            <>
              <iframe title="Claim form" src={url} className="hidden h-[85vh] w-full rounded-[8px] border border-[color:var(--line)] bg-white md:block" />
              {/* Phones can't scroll or zoom a PDF shown inside a page, so there it opens in the phone's own PDF viewer instead. */}
              <div className="flex flex-col gap-3 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 md:hidden">
                <p className="text-[13px] text-[color:var(--ink)]">The claim form is ready. Open it in your phone&apos;s PDF viewer to scroll and zoom, or save it.</p>
                <div className="flex flex-wrap gap-2">
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-[38px] items-center rounded-full bg-[color:var(--brand)] px-5 text-[13px] text-white">Open the form</a>
                  <a href={url} download={fileName} className="inline-flex h-[38px] items-center rounded-full border border-[color:var(--line)] px-5 text-[13px] text-[color:var(--ink)]">Download</a>
                </div>
              </div>
              {busy && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Updating…</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
