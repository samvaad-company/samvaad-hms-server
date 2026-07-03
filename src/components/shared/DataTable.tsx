import { type CSSProperties, type ReactNode } from "react";
import { tw } from "@/lib/design-system";

export interface Column {
  label: string;
  /** CSS grid track size, e.g. "180px", "1fr", "minmax(140px,1fr)". */
  width: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps {
  columns: Column[];
  children: ReactNode;
  minWidth?: number;
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
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth, "--cols": template } as CSSProperties}>
        <div className={tw.table.headerRow} style={{ gridTemplateColumns: "var(--cols)" }}>
          {columns.map((col) => (
            <span
              key={col.label}
              className={`text-[12px] font-medium text-[#11111c] leading-[16px] whitespace-nowrap overflow-hidden text-ellipsis ${
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
