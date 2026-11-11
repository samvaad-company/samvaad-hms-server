/** Builds the insurer's own PDF form with a pre-auth form's details printed in its boxes (browser side). */
import type { PreauthDTO, PreauthValues } from "../../types/preauth";
import { EXACT_FORMS } from "./forms";
import { fillPreauthPdf, type PdfTemplate } from "./pdf-fill";

const cache = new Map<string, Promise<unknown>>();
const once = <T>(key: string, load: () => Promise<T>) => { if (!cache.has(key)) cache.set(key, load().catch((e) => { cache.delete(key); throw e; })); return cache.get(key) as Promise<T>; };

export const hasExactForm = (formKey: string | undefined): boolean => !!formKey && formKey in EXACT_FORMS;

export async function buildExactPdf(form: Pick<PreauthDTO, "formKey" | "formName" | "patientName" | "doctorSignatureImg" | "doctorStampImg" | "hospitalStampImg" | "doctorSignedAt"> & { patientSignatureImg?: string | null }, values: PreauthValues): Promise<Blob> {
  const ex = EXACT_FORMS[form.formKey];
  if (!ex) throw new Error("This insurer's form isn't available as a PDF yet.");
  const [pdf, tpl] = await Promise.all([
    // "no-cache" makes the browser check for a newer copy each time the page opens, so a corrected form layout is used straight away.
    once(ex.pdf, async () => new Uint8Array(await (await fetch(ex.pdf, { cache: "no-cache" })).arrayBuffer())),
    once(ex.template, async () => (await (await fetch(ex.template, { cache: "no-cache" })).json()) as PdfTemplate),
  ]);
  const bytes = await fillPreauthPdf(pdf, tpl, values, {
    doctorSignatureImg: form.doctorSignatureImg, doctorStampImg: form.doctorStampImg, hospitalStampImg: form.hospitalStampImg, patientSignatureImg: form.patientSignatureImg,
    defaultDate: form.doctorSignedAt?.slice(0, 10) ?? null, patientName: form.patientName, formName: form.formName,
  });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name.replace(/[^\w.\- ]+/g, "_");
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Opens the PDF in a hidden frame and prints it. If the browser won't print from a frame, opens it in a new tab instead. */
export function printBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = url;
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
    catch { window.open(url, "_blank"); }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
  };
  document.body.appendChild(frame);
}
