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
 * Download a document as a self-contained HTML file.
 *
 * Distinct from `printElement`, which opens the print dialog: this saves a file
 * directly. The file keeps the document's styling and opens (and prints) in any
 * browser, so it works as an attachable copy without adding a PDF dependency.
 */
export function downloadElement(el: HTMLElement | null, title = "Document"): void {
  if (!el || typeof window === "undefined") return;

  const blob = new Blob([standaloneHtml(el, title)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w.\- ]+/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
