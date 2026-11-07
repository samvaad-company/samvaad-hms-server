"use client";

/** One pre-auth form: fill it in, send it for signing, then the doctor signs and the hospital's admin stamps it. Prints as the insurer's own form. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, PenLine, Printer, Send, Stamp, Trash2 } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { printElement, downloadElement } from "@/lib/print";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PreauthDocument } from "@/components/preauth/PreauthDocument";
import { ExactPdfView } from "@/components/preauth/ExactPdfView";
import { buildExactPdf, downloadBlob, hasExactForm, printBlob } from "@/lib/preauth/exact";
import { PREAUTH_FORMS } from "@/lib/preauth/forms";
import type { PreauthDTO, SignatureAssetsDTO } from "@/types/preauth";

export default function PreauthFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, can } = useAuth();
  const { item: form, loading, error: loadError, reload } = useItem<PreauthDTO>(`/preauth/${id}`);
  useBreadcrumb("/preauth", "Pre-auth forms", form ? `${form.patientName} · ${form.formName}` : "Form");
  const { run, loading: acting, error, reset } = useMutation();
  const docRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<"fill" | "pdf">("fill");
  const [pdfError, setPdfError] = useState("");

  useEffect(() => { if (form) { setValues(form.values); setDirty(false); } }, [form]);

  const def = useMemo(() => PREAUTH_FORMS.find((f) => f.key === form?.formKey), [form?.formKey]);
  const isItsDoctor = user?.role === "Doctor" && user.doctorId === form?.doctorId;
  const isAdmin = user?.role === "Super Admin";
  const canFill = !!form && (form.status === "Draft" || form.status === "Awaiting doctor") && (can("tpa", "write") || isItsDoctor);
  const { item: assets } = useItem<SignatureAssetsDTO>(isItsDoctor || isAdmin ? "/signature-assets" : null);

  if (loadError) return <p className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>{loadError.message}</p>;
  if (loading || !form || !def) return <p className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>Loading…</p>;

  const act = async (fn: () => Promise<unknown>) => { reset(); await run(fn); reload(); };
  const save = async () => { await act(() => api.put(`/preauth/${form.id}`, { values })); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const send = async () => { if (dirty) await api.put(`/preauth/${form.id}`, { values }); await act(() => api.post(`/preauth/${form.id}/submit`)); };
  const sign = () => act(() => api.post(`/preauth/${form.id}/sign`, { values: { declQualification: values.declQualification ?? "", declRegNo: values.declRegNo ?? "" } }));
  const stamp = () => act(() => api.post(`/preauth/${form.id}/stamp`));
  const remove = async () => { if (!confirm("Delete this pre-auth form?")) return; await run(() => api.del(`/preauth/${form.id}`)); router.push("/preauth"); };
  const title = `Pre-auth — ${form.patientName} — ${form.formName}`;
  /** Forms with the insurer's real PDF print onto it, box for box; the rest print from the layout on this page. */
  const exact = hasExactForm(form.formKey);
  const withPdf = async (use: (b: Blob) => void) => {
    setPdfError("");
    try { use(await buildExactPdf(form, values)); } catch (e) { setPdfError(e instanceof Error ? e.message : "Couldn't prepare the PDF."); }
  };

  const needsSignature = isItsDoctor && form.status === "Awaiting doctor" && !assets?.doctorSignature;
  const needsStamp = isAdmin && form.status === "Awaiting stamp" && !assets?.hospitalStamp;
  const btn = "inline-flex h-[34px] items-center gap-2 rounded-full px-4 text-[13px] cursor-pointer disabled:opacity-50";
  const primary = `${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`;
  const ghost = `${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]`;

  return (
    <div className={`${tw.gutterX} mb-[30px] flex flex-col gap-4 pt-5`}>
      <div className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-3 p-4`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium text-[color:var(--ink)]">{form.patientName}</p>
          <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{form.formName} · Dr. {form.doctorName.replace(/^Dr\.?\s*/i, "") || "not chosen"}</p>
        </div>
        <StatusBadge status={form.status} />
        <div className="flex flex-wrap gap-2">
          {canFill && <button onClick={save} disabled={acting || !dirty} className={ghost}>{saved ? "Saved" : "Save"}</button>}
          {form.status === "Draft" && can("tpa", "write") && <button onClick={send} disabled={acting} className={primary}><Send size={14} /> Send for signing</button>}
          {form.status === "Awaiting doctor" && isItsDoctor && <button onClick={sign} disabled={acting || !assets?.doctorSignature} className={primary}><PenLine size={14} /> Sign this form</button>}
          {form.status === "Awaiting stamp" && isAdmin && <button onClick={stamp} disabled={acting || !assets?.hospitalStamp} className={primary}><Stamp size={14} /> Stamp this form</button>}
          <button onClick={() => (exact ? withPdf((b) => printBlob(b)) : printElement(docRef.current, title))} className={ghost}><Printer size={14} /> Print</button>
          <button onClick={() => (exact ? withPdf((b) => downloadBlob(b, `${title}.pdf`)) : downloadElement(docRef.current, title))} className={ghost}><Download size={14} /> {exact ? "Download PDF" : "Download"}</button>
          {can("tpa", "write") && (form.status !== "Ready" || isAdmin) && <button onClick={remove} className={`${btn} text-[#c8001a] hover:bg-[#ffe9e9]`}><Trash2 size={14} /> Delete</button>}
        </div>
      </div>

      {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
      {form.status === "Awaiting doctor" && (
        <p className="rounded-[8px] bg-[#fff6dd] px-3 py-2 text-[13px] text-[#7a4a00]">
          {isItsDoctor ? (needsSignature ? "Add your signature on the Pre-auth forms page first, then come back to sign." : "Check the details, then sign. Your qualification and registration number go on the form.") : `Waiting for ${form.doctorName || "the doctor"} to sign.`}
        </p>
      )}
      {form.status === "Awaiting stamp" && (
        <p className="rounded-[8px] bg-[#e8f4ff] px-3 py-2 text-[13px] text-[#0a5fc4]">
          {isAdmin ? (needsStamp ? "Add the hospital stamp on the Pre-auth forms page first, then come back to stamp." : `Signed by ${form.doctorSignedBy}. Stamp it to finish.`) : `Signed by ${form.doctorSignedBy}. Waiting for the hospital's admin to stamp it.`}
        </p>
      )}
      {form.status === "Ready" && <p className="rounded-[8px] bg-[#dffff3] px-3 py-2 text-[13px] text-[#0b7a47]">Signed by {form.doctorSignedBy} and stamped by {form.stampedBy}. Ready to send to the insurer.</p>}

      {pdfError && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{pdfError}</p>}
      {exact && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[color:var(--line)] p-[3px] text-[13px]" role="tablist">
            {([["fill", "Fill in details"], ["pdf", `${form.formName} form (PDF)`]] as const).map(([id2, label]) => (
              <button key={id2} role="tab" aria-selected={view === id2} onClick={() => setView(id2)} className={`cursor-pointer rounded-full px-4 py-[5px] ${view === id2 ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--ink-soft)]"}`}>{label}</button>
            ))}
          </div>
          <span className="text-[12px] text-[color:var(--ink-soft)]">The PDF is the insurer&apos;s own form with your details in its boxes. Print and Download use it.</span>
        </div>
      )}
      {exact && view === "pdf" && <ExactPdfView form={form} values={values} />}
      <div ref={docRef} hidden={exact && view === "pdf"} className={`${tw.surface.card} ${tw.radius.card} mx-auto w-full max-w-[900px] overflow-hidden`}>
        <PreauthDocument def={def} values={values} editable={canFill} onChange={(k, v) => { setValues((p) => ({ ...p, [k]: v })); setDirty(true); }}
          declarationEditable={isItsDoctor && form.status === "Awaiting doctor"}
          doctorSignatureImg={form.doctorSignatureImg} doctorStampImg={form.doctorStampImg} hospitalStampImg={form.hospitalStampImg} doctorSignedAt={form.doctorSignedAt} />
      </div>
    </div>
  );
}
