import { type LucideIcon } from "lucide-react";

interface StatPillProps {
  icon: LucideIcon;
  value: string;
  label: string;
}

export function StatPill({ icon: Icon, value, label }: StatPillProps) {
  return (
    <div className="bg-[color:var(--surface)] flex items-center gap-[10px] px-[15px] py-[6px] rounded-full">
      <Icon size={24} strokeWidth={1.5} className="text-[color:var(--ink)] shrink-0" />
      <div className="flex items-center gap-[5px]">
        <span className="text-[16px] font-medium text-[color:var(--ink)] leading-5 whitespace-nowrap">
          {value}
        </span>
        <span className="text-[14px] font-normal text-[color:var(--ink-soft)] leading-[19px] whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
