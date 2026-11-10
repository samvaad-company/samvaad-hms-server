"use client";

/**
 * Turns the case file into one PDF (every page of every form, in order) or opens it for printing. Nothing leaves the browser and
 * nothing is paid for: the sheets are drawn into a hidden frame, each page is captured, and the pictures are placed on A4 pages.
 */
import { createElement } from "react";
import type { CaseFileDTO } from "@/types/casefile";
import { FORMS, type FormDef } from "@/lib/casefile/forms";
import { CASEFILE_CSS } from "@/lib/casefile/css";

const PAGE_W = 794;

async function pagesHtml(file: CaseFileDTO, defs: FormDef[]): Promise<string> {
  // Loaded only when printing, so the rest of the app never carries them.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { PrintPages } = await import("@/components/casefile/FormEngine");
  return renderToStaticMarkup(createElement("div", { className: "cf cf-print" }, defs.map((d) => createElement(PrintPages, { key: d.key, def: d, data: file.forms[d.key]?.data ?? {}, file }))));
}

const documentFor = (body: string, title: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, "")}</title><style>${CASEFILE_CSS}
  @page{size:A4;margin:0} html,body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact} .cf-page{page-break-after:always;break-after:page;overflow:hidden;height:1123px} .cf-noprint{display:none!important}</style></head><body>${body}</body></html>`;

/** The forms to put in the PDF, in the order this hospital keeps them. */
export function chosenForms(file: CaseFileDTO, keys?: string[]): FormDef[] {
  const inOrder = file.order.map((k) => FORMS.find((f) => f.key === k)).filter((f): f is FormDef => !!f);
  return keys?.length ? inOrder.filter((f) => keys.includes(f.key)) : inOrder;
}

/** The file name staff would expect: the patient, the admission and the day. */
export function pdfName(file: CaseFileDTO, suffix = "Case file"): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9 _.-]+/g, "").trim().replace(/\s+/g, "_");
  return `${safe(suffix)}_${safe(file.patient.name) || "patient"}_${safe(file.admission.ipdNo)}.pdf`;
}

export async function buildCaseFilePdf(file: CaseFileDTO, keys?: string[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const defs = chosenForms(file, keys);
  const html = documentFor(await pagesHtml(file, defs), `${file.patient.name} case file`);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: `${PAGE_W}px`, height: "1200px", border: "0", visibility: "hidden" });
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    await new Promise((r) => setTimeout(r, 150));
    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".cf-page"));
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const W = 210, H = 297;
    let first = true;
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      el.style.height = "auto"; el.style.minHeight = "1123px"; el.style.overflow = "visible"; // a page that grew is cut into A4 pieces below
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: PAGE_W });
      const sliceH = Math.round((canvas.width * H) / W); // canvas pixels per A4 page
      for (let y = 0; y < canvas.height - 2; y += sliceH) {
        const part = document.createElement("canvas");
        part.width = canvas.width; part.height = Math.min(sliceH, canvas.height - y);
        part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
        if (!first) pdf.addPage("a4", "portrait");
        first = false;
        pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, W, (part.height / canvas.width) * W, undefined, "FAST");
      }
      onProgress?.(i + 1, pages.length);
      await new Promise((r) => setTimeout(r, 0)); // let the screen breathe between pages
    }
    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Opens the sheets in a window and starts the browser's print dialog (which can also save as PDF). */
export async function printCaseFile(file: CaseFileDTO, keys?: string[]): Promise<void> {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) throw new Error("Your browser blocked the print window. Allow pop-ups for this site and try again.");
  win.document.open();
  win.document.write(documentFor(await pagesHtml(file, chosenForms(file, keys)), `${file.patient.name} case file`));
  win.document.close();
  let fired = false;
  const fire = () => { if (fired) return; fired = true; win.focus(); win.print(); };
  win.addEventListener("load", fire);
  setTimeout(fire, 800);
}
