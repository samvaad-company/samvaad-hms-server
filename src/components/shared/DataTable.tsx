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
      {css && <style>{css}</style>}
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
