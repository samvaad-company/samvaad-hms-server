"use client";

/**
 * Print (or "Save as PDF") a single element in isolation — without the app
 * chrome (sidebar, top bar, action buttons). Opens a lightweight window
 * containing only the target document, copies the app's stylesheets so it keeps
 * its styling, and triggers the browser's print dialog.
 *
 * Using a dedicated window guarantees that only the invoice / prescription /
 * report is printed or exported, regardless of what else is on the page.
 */
export function printElement(el: HTMLElement | null, title = "Document"): void {
  if (!el || typeof window === "undefined") return;

  const win = window.open("", "_blank", "width=980,height=1200");
  if (!win) return; // popup blocked — do nothing rather than printing the page

  // Carry over the app's stylesheets so Tailwind classes render in the new window.
  const styleTags = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join("\n");

  win.document.open();
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
      styleTags +
      `<style>` +
      `@page{margin:14mm}` +
      `html,body{background:#fff!important;margin:0;padding:0}` +
      `body{padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
      `.no-print{display:none!important}` +
      `</style></head><body>${el.outerHTML}</body></html>`,
  );
  win.document.close();

  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    win.focus();
    win.print();
  };
  win.addEventListener("load", fire);
  // Fallback: some browsers don't fire `load` for document.write windows.
  window.setTimeout(fire, 700);
}

/** Wrap an element's markup in a standalone, styled HTML document. */
function standaloneHtml(el: HTMLElement, title: string): string {
  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join("\n");

  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
    styles +
    `<style>` +
    `@page{margin:14mm}` +
    `html,body{background:#fff!important;margin:0;padding:0}` +
    `body{padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `.no-print{display:none!important}` +
    `</style></head><body>${el.outerHTML}</body></html>`
  );
}

/**
 * Download a document as a PDF.
 *
 * Distinct from `printElement`, which opens the print dialog: this saves a file
 * directly. The element is captured as it looks on screen and cut into A4 pages.
 * (If that picture can't be taken, the document is saved as a web page rather than lost.)
 */
export async function downloadElement(el: HTMLElement | null, title = "Document"): Promise<void> {
  if (!el || typeof window === "undefined") return;
  const name = title.replace(/[^\w.\- ]+/g, "_");
  try {
    const blob = await elementToPdfBlob(el);
    saveBlob(blob, `${name}.pdf`);
  } catch {
    // If the picture of the page can't be taken, keep the document rather than lose it: save it as a web page instead.
    saveBlob(new Blob([standaloneHtml(el, title)], { type: "text/html;charset=utf-8" }), `${name}.html`);
  }
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** The element as it looks on screen, cut into A4 pages with a margin, as a PDF. Nothing leaves the browser. */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([import("html2canvas"), import("pdf-lib")]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
  const A4: [number, number] = [595.28, 841.89];
  const margin = 28;
  const contentW = A4[0] - margin * 2, contentH = A4[1] - margin * 2;
  const sliceH = Math.floor((canvas.width * contentH) / contentW);
  const doc = await PDFDocument.create();
  for (let y = 0; y < canvas.height; y += sliceH) {
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = Math.min(sliceH, canvas.height - y);
    part.getContext("2d")?.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
    const img = await doc.embedPng(part.toDataURL("image/png"));
    const h = (part.height / canvas.width) * contentW;
    const page = doc.addPage(A4);
    page.drawImage(img, { x: margin, y: A4[1] - margin - h, width: contentW, height: h });
  }
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}

/**
 * Share a document link using the native share sheet, falling back to copying
 * the link to the clipboard.
 */
export async function shareDocument(title: string, url: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch {
      // User dismissed the sheet, or sharing is unavailable — fall through.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    window.alert("Link copied to clipboard");
  } catch {
    window.prompt("Copy this link", url);
  }
}
