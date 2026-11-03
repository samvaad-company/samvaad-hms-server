"use client";

import { useEffect } from "react";

/**
 * Phones and tablets show plain tables as stacked cards (see globals.css), which need each cell's column name.
 * This copies the <thead> text onto every cell as `data-label`, and keeps doing so as tables load and change.
 * Hand-built "grids as tables" (a header row of columns followed by rows with the same grid template) get the same
 * treatment: the header and its rows are tagged `data-gt-*` so globals.css can stack them.
 */
export function useTableLabels(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.getElementById("app-scroll");
    if (!root) return;
    let frame = 0;

    const labelGrids = () => {
      root.querySelectorAll<HTMLElement>('[style*="grid-template-columns"]').forEach((head) => {
        const tpl = head.style.gridTemplateColumns;
        if (!tpl || tpl.includes("--cols") || head.hasAttribute("data-gt-head") || head.hasAttribute("data-gt-row")) return;
        const first = head.nextElementSibling as HTMLElement | null;
        // Only the grey header bar of a hand-built table counts, so rows of form fields are left alone. A header over an
        // empty-state message (no rows yet) is still a header.
        if (!head.className.includes("subtle-3")) return;
        if (!first) return;
        if (head.children.length < 3 || head.querySelector("input,select,textarea,button,a")) return;
        const names = Array.from(head.children).map((c) => (c.textContent ?? "").trim());
        if (!names.some(Boolean)) return;
        head.setAttribute("data-gt-head", "");
        head.parentElement?.setAttribute("data-gt-wrap", "");
        head.parentElement?.parentElement?.setAttribute("data-gt-scroll", "");
        for (let el = head.nextElementSibling as HTMLElement | null; el && el.style.gridTemplateColumns === tpl; el = el.nextElementSibling as HTMLElement | null) {
          el.setAttribute("data-gt-row", "");
          Array.from(el.children).forEach((cell, i) => {
            if (names[i] && cell.getAttribute("data-label") !== names[i]) cell.setAttribute("data-label", names[i]);
          });
        }
      });
      // Rows added later (a new page of results) join a header that is already tagged.
      root.querySelectorAll<HTMLElement>("[data-gt-head]").forEach((head) => {
        const tpl = head.style.gridTemplateColumns;
        const names = Array.from(head.children).map((c) => (c.textContent ?? "").trim());
        for (let el = head.nextElementSibling as HTMLElement | null; el && el.style.gridTemplateColumns === tpl; el = el.nextElementSibling as HTMLElement | null) {
          if (el.hasAttribute("data-gt-row") && Array.from(el.children).every((c, i) => !names[i] || c.getAttribute("data-label") === names[i])) continue;
          el.setAttribute("data-gt-row", "");
          Array.from(el.children).forEach((cell, i) => {
            if (names[i] && cell.getAttribute("data-label") !== names[i]) cell.setAttribute("data-label", names[i]);
          });
        }
      });
    };

    /** Tables drawn with absolutely positioned cells (`left: 250px` etc.): a header row, then rows laid out the same way. */
    const isAbsRow = (el: Element | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement) || el.children.length < 3) return false;
      return Array.from(el.children).every((c) => c instanceof HTMLElement && c.style.left !== "" && getComputedStyle(c).position === "absolute");
    };
    const labelAbsolute = () => {
      root.querySelectorAll<HTMLElement>('[style*="min-width"]').forEach((head) => {
        if (head.hasAttribute("data-ag-head") || head.hasAttribute("data-ag-row") || !isAbsRow(head) || !isAbsRow(head.nextElementSibling)) return;
        if (head.querySelector("input,select,textarea,button,a")) return;
        head.setAttribute("data-ag-head", "");
        head.parentElement?.setAttribute("data-gt-wrap", "");
        head.parentElement?.parentElement?.setAttribute("data-gt-scroll", "");
      });
      root.querySelectorAll<HTMLElement>("[data-ag-head]").forEach((head) => {
        const cols = Array.from(head.children).map((c) => ({ left: parseFloat((c as HTMLElement).style.left) || 0, text: (c.textContent ?? "").trim() }));
        for (let el = head.nextElementSibling; isAbsRow(el); el = el.nextElementSibling) {
          el.setAttribute("data-ag-row", "");
          Array.from(el.children).forEach((cell) => {
            const left = parseFloat((cell as HTMLElement).style.left) || 0;
            const col = cols.filter((c) => c.left <= left + 1).sort((a, b) => b.left - a.left)[0];
            if (col?.text && cell.getAttribute("data-label") !== col.text) cell.setAttribute("data-label", col.text);
          });
        }
      });
    };

    const label = () => {
      frame = 0;
      labelGrids();
      labelAbsolute();
      root.querySelectorAll<HTMLTableElement>(".overflow-x-auto > table").forEach((table) => {
        const head = table.querySelector("thead tr");
        if (!head) return;
        const names: string[] = [];
        head.querySelectorAll("th,td").forEach((th) => {
          const span = Number((th as HTMLTableCellElement).colSpan) || 1;
          for (let i = 0; i < span; i++) names.push((th.textContent ?? "").trim());
        });
        table.querySelectorAll("tbody tr, tfoot tr").forEach((tr) => {
          let col = 0;
          Array.from(tr.children).forEach((cell) => {
            const name = names[col] ?? "";
            if (name && cell.getAttribute("data-label") !== name) cell.setAttribute("data-label", name);
            col += (cell as HTMLTableCellElement).colSpan || 1;
          });
        });
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(label);
    };
    label();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active]);
}
