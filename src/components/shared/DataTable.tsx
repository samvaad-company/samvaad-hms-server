import { useId, type CSSProperties, type ReactNode } from "react";
import { tw } from "@/lib/design-system";

export interface Column {
  label: string;
  /** CSS grid track size, e.g. "180px", "1fr", "minmax(140px,1fr)". */
  width: string;
  align?: "left" | "right" | "center";
  /**
   * Hide this column while the table's own width (the card it sits in, not the window) is below this many pixels, so a
   * narrow screen drops the least important columns instead of scrolling sideways. Leave it off for columns that must stay.
   */
  hideBelow?: number;
}

interface DataTableProps {
  columns: Column[];
  children: ReactNode;
  minWidth?: number;
}

/** The grid's column gap (`gap-3`) — a hidden column frees its gap along with its track. */
const GAP = 12;

/** The least width a grid track needs: 180px, minmax(140px,1fr) → 140; a bare fr track counts as 120. */
function trackMin(width: string): number {
  const n = /(\d+(?:\.\d+)?)px/.exec(width);
  return n ? Number(n[1]) : 120;
}

/**
 * CSS that, at each `hideBelow` threshold, removes the columns that give way there: their cells are hidden, the grid template
 * loses their tracks and the table's minimum width shrinks by what they needed. Container queries, so it follows the card width.
 */
function responsiveCss(id: string, columns: Column[], minWidth: number): string {
  const thresholds = [...new Set(columns.map((c) => c.hideBelow).filter((n): n is number => typeof n === "number"))].sort((a, b) => b - a);
  return thresholds.map((t) => {
    const hidden = columns.map((c, i) => ({ c, i })).filter(({ c }) => (c.hideBelow ?? 0) >= t);
    const kept = columns.filter((c) => !((c.hideBelow ?? 0) >= t));
    const saved = hidden.reduce((n, { c }) => n + trackMin(c.width) + GAP, 0);
    const cells = hidden.map(({ i }) => `.${id} > div > * > :nth-child(${i + 1})`).join(",");
    return `@container (max-width: ${t - 1}px){.${id} > div{--cols:${kept.map((c) => c.width).join(" ")} !important;min-width:${Math.max(320, minWidth - saved)}px !important}${cells}{display:none}}`;
  }).join("");
}

/**
 * Phones and tablets: no sideways scrolling. The header goes, and each row becomes a card: its first cell is the title and the
 * rest sit two to a line under their column name (the names are drawn from `columns`, so a row's markup needs no change).
 */
function cardCss(id: string, columns: Column[]): string {
  const row = `.${id} > div > [style*="--cols"]:not(:first-child)`;
  const labels = columns
    .map((c, i) => (i === 0 || !c.label.trim() ? "" : `${row} > :nth-child(${i + 1})::before{content:"${c.label.replace(/["\\]/g, "")}";flex:0 0 100%;display:block;font-size:11px;line-height:14px;color:var(--ink-soft);margin-bottom:1px;font-weight:400;text-align:left}`))
    .join("");
  return `@media (max-width:1023px){${`.${id}`}{overflow-x:visible!important}.${id} > div{min-width:0!important}.${id} > div > :first-child{display:none!important}${row}{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px 16px!important;height:auto!important;padding:12px 14px!important;align-items:start!important}${row} > *{min-width:0;overflow-wrap:anywhere;flex-wrap:wrap;text-align:left!important;justify-content:flex-start!important}${row} > :first-child{grid-column:1/-1}${row} > :empty{display:none!important}${row} > *,${row} .truncate{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}${labels}}`;
}

/**
 * Grid-based table. The column template is published as a `--cols` CSS variable
 * on the scroll container so both the header and every row (rendered as
 * children) stay aligned. Each field gets its own column — no stacking.
 */
export function DataTable({
  columns,
  children,
  minWidth = tw.table.minWidth,
}: DataTableProps) {
  const template = columns.map((c) => c.width).join(" ");
  const id = `dt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const css = responsiveCss(id, columns, minWidth);
  return (
    <div className={`overflow-x-auto ${id}`} style={css ? { containerType: "inline-size" } : undefined}>
      <style>{css + cardCss(id, columns)}</style>
      <div style={{ minWidth, "--cols": template } as CSSProperties}>
        <div className={tw.table.headerRow} style={{ gridTemplateColumns: "var(--cols)" }}>
          {columns.map((col) => (
            <span
              key={col.label}
              className={`text-[12px] font-medium text-[color:var(--ink)] leading-[16px] whitespace-nowrap overflow-hidden text-ellipsis ${
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                    ? "text-center"
                    : ""
              }`}
            >
              {col.label}
            </span>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
