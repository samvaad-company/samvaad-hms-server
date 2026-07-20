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
