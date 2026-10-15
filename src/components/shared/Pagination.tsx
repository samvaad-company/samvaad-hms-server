"use client";

/**
 * Page controls for the list screens: "Showing 1–25 of 126", a rows-per-page picker, and page numbers.
 * Used through `usePagination(rows)`, which slices the rows for the current page and hands back this bar
 * ready to place under the table. Paging is on screen only (the lists are already loaded), so search and
 * filters always cover every row, and a new search or filter starts again from page 1.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_SIZE = 25;

/** Page numbers to show: first, last, and a window around the current page, with "…" for the gaps. */
function pageList(current: number, total: number): (number | "gap-l" | "gap-r")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) { pages.add(2); pages.add(3); pages.add(4); }
  if (current >= total - 2) { pages.add(total - 1); pages.add(total - 2); pages.add(total - 3); }
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap-l" | "gap-r")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(i < sorted.length / 2 ? "gap-l" : "gap-r");
    out.push(p);
  });
  return out;
}

interface BarProps {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  unit: string;
}

function Bar({ total, page, pageSize, onPage, onPageSize, unit }: BarProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "h-[28px] min-w-[28px] px-2 inline-flex items-center justify-center rounded-[8px] text-[12px] transition-colors";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 border-t border-[color:var(--line)]">
      <div className="flex items-center gap-3 text-[12px] text-[color:var(--ink-soft)]">
        <span>
          Showing <b className="font-medium text-[color:var(--ink)]">{from}–{to}</b> of <b className="font-medium text-[color:var(--ink)]">{total}</b> {unit}
        </span>
        <label className="flex items-center gap-[6px]">
          <span className="hidden sm:inline">Rows</span>
          <span className="relative inline-flex items-center">
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              autoComplete="off"
              className="appearance-none h-[28px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-3 pr-8 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-[10px] text-[color:var(--ink-soft)]" />
          </span>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"
          className={`${btn} text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}>
          <ChevronLeft size={14} />
        </button>
        {pageList(page, pages).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-[12px] text-[color:var(--ink-soft)]">…</span>
          ) : (
            <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}
              className={`${btn} cursor-pointer ${p === page ? "bg-[color:var(--brand)] text-white font-medium" : "text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>
              {p}
            </button>
          ),
        )}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"
          className={`${btn} text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}>
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}

/**
 * Slice `rows` into pages. Returns the rows to show now and the bar to render under the table (null when
 * everything fits on one page of the smallest size). The page resets to 1 whenever the rows change in
 * number or at either end — i.e. after a search, filter or tab change.
 */
export function usePagination<T>(
  rows: T[],
  unit = "records",
  /** What identifies a row (default: its `id`); used to notice that the list changed. */
  keyOf: (row: T) => unknown = (row) => (row as { id?: unknown }).id,
): { rows: T[]; bar: ReactNode } {
  const [state, setState] = useState({ page: 1, size: DEFAULT_SIZE, key: "" });
  const key = `${rows.length}|${String(rows.length ? keyOf(rows[0]) : "")}|${String(rows.length ? keyOf(rows[rows.length - 1]) : "")}`;
  const pages = Math.max(1, Math.ceil(rows.length / state.size));
  const page = state.key === key ? Math.min(state.page, pages) : 1;

  const start = (page - 1) * state.size;
  const pageRows = rows.length <= state.size ? rows : rows.slice(start, start + state.size);

  const bar = rows.length <= PAGE_SIZES[0]
    ? null
    : (
      <Bar
        total={rows.length} page={page} pageSize={state.size} unit={unit}
        onPage={(p) => setState((s) => ({ ...s, page: Math.min(Math.max(1, p), pages), key }))}
        onPageSize={(n) => setState({ page: 1, size: n, key })}
      />
    );
  return { rows: pageRows, bar };
}
