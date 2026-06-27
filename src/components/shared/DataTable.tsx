import { tw } from "@/lib/design-system";

interface Column {
  label: string;
  left: number;
}

interface DataTableProps {
  columns: Column[];
  children: React.ReactNode;
  minWidth?: number;
}

export function DataTable({
  columns,
  children,
  minWidth = tw.table.minWidth,
}: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>
        <div
          className={`${tw.table.headerRow} shrink-0`}
          style={{ minWidth }}
        >
          {columns.map((col) => (
            <span
              key={col.label}
              className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap"
              style={{ left: col.left }}
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
