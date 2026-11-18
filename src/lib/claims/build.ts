/** Builds an insurer's claim form PDF with a patient's details printed on it (browser side). */
import { claimPdfUrl, claimTemplateUrl } from "./forms";
import { PDFDocument } from "pdf-lib";
import { fillClaimPdf, type ClaimTemplate, type ClaimValues } from "./claim-fill";

const cache = new Map<string, Promise<unknown>>();
const once = <T>(key: string, load: () => Promise<T>) => { if (!cache.has(key)) cache.set(key, load().catch((e) => { cache.delete(key); throw e; })); return cache.get(key) as Promise<T>; };

const GENERIC: ClaimTemplate = { pdf: "", pages: 1, partB: true, fields: {}, summary: true, blank: true };

export function loadClaimTemplate(formKey: string): Promise<ClaimTemplate> {
  if (formKey === "generic") return Promise.resolve(GENERIC);
  return once(`tpl:${formKey}`, async () => {
    const r = await fetch(claimTemplateUrl(formKey), { cache: "no-cache" });
    if (!r.ok) throw new Error("This insurer's claim form isn't available yet.");
    return (await r.json()) as ClaimTemplate;
  });
}

export async function buildClaimPdf(formKey: string, meta: { formName: string; patientName: string }, values: ClaimValues): Promise<Blob> {
  const [pdf, tpl] = await Promise.all([
    once(`pdf:${formKey}`, async () => {
      if (formKey === "generic") { const d = await PDFDocument.create(); d.addPage([595.28, 841.89]); return new Uint8Array(await d.save()); }
      const r = await fetch(claimPdfUrl(formKey), { cache: "no-cache" });
      if (!r.ok) throw new Error("This insurer's claim form isn't available yet.");
      return new Uint8Array(await r.arrayBuffer());
    }),
    loadClaimTemplate(formKey),
  ]);
  const bytes = await fillClaimPdf(pdf, tpl, values, { formName: meta.formName, patientName: meta.patientName });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
