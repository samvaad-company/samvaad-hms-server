import { tw } from "@/lib/design-system";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cls = tw.statusBadge[status] ?? "bg-[#f0f0f0] text-[#57575f]";
  return (
    <span
      className={`inline-flex items-center justify-center px-[10px] py-[5px] rounded-full text-[14px] font-normal leading-[19px] whitespace-nowrap ${cls}`}
    >
      {status}
    </span>
  );
}
