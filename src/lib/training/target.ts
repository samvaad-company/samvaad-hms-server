/**
 * Finding the thing a tour step points at. Steps name their target by CSS or by what it says (a button's label, a field's
 * placeholder), so a tour keeps working without every screen having to carry tour markers.
 */

export type Scope = "auto" | "main" | "dialog" | "side" | "page";
export type Kind = "any" | "button" | "input" | "heading" | "label";
export type Target = { css: string } | { text: string; scope?: Scope; kind?: Kind };

const SELECTORS: Record<Kind, string> = {
  button: "button, [role=button], a, [role=tab], [role=radio], [role=option]",
  input: "input, select, textarea, [role=combobox]",
  heading: "h1, h2, h3",
  label: "label, legend",
  any: "button, [role=button], a, [role=tab], [role=radio], input, select, textarea, [role=combobox], h1, h2, h3, label, legend",
};

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function isVisible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const s = getComputedStyle(el as HTMLElement);
  return s.visibility !== "hidden" && s.display !== "none";
}

/** The topmost open dialog, if there is one. */
export const openDialog = (): HTMLElement | null => {
  const all = [...document.querySelectorAll<HTMLElement>("[role=dialog]")].filter((d) => !d.hasAttribute("data-tour-card") && isVisible(d));
  return all[all.length - 1] ?? null;
};

function roots(scope: Scope): ParentNode[] {
  const dialog = openDialog();
  if (scope === "dialog") return dialog ? [dialog] : [];
  if (scope === "main") return [document.getElementById("app-scroll") ?? document];
  if (scope === "side") return [document.querySelector("aside") ?? document];
  if (scope === "page") return [document];
  // auto: the dialog when one is open, otherwise the page content
  return dialog ? [dialog] : [document.getElementById("app-scroll") ?? document];
}

export function findTarget(t: Target): HTMLElement | null {
  if ("css" in t) {
    const hit = [...document.querySelectorAll<HTMLElement>(t.css)].find(isVisible);
    return hit ?? null;
  }
  const want = norm(t.text);
  for (const root of roots(t.scope ?? "auto")) {
    for (const el of root.querySelectorAll<HTMLElement>(SELECTORS[t.kind ?? "any"])) {
      if (!isVisible(el)) continue;
      const own = el.matches("input, select, textarea") ? el.getAttribute("placeholder") ?? el.getAttribute("aria-label") : el.textContent;
      const label = norm(own) || norm(el.getAttribute("aria-label"));
      if (label && label.startsWith(want)) return el;
    }
  }
  return null;
}

/** Fold every sidebar group open, so a tour can point at any item in it. */
export function unfoldSidebar(): void {
  try { localStorage.removeItem("samvaad.sidebar.collapsed"); window.dispatchEvent(new StorageEvent("storage", { key: "samvaad.sidebar.collapsed" })); } catch { /* the sidebar stays as it was */ }
}
