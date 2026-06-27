import { type LucideIcon } from "lucide-react";

interface StatPillProps {
  icon: LucideIcon;
  value: string;
  label: string;
}

export function StatPill({ icon: Icon, value, label }: StatPillProps) {
  return (
    <div className="bg-white flex items-center gap-[10px] px-[15px] py-[6px] rounded-full">
      <Icon size={24} strokeWidth={1.5} className="text-[#11111c] shrink-0" />
      <div className="flex items-center gap-[5px]">
        <span className="text-[16px] font-medium text-[#11111c] leading-5 whitespace-nowrap">
          {value}
        </span>
        <span className="text-[14px] font-normal text-[#57575f] leading-[19px] whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
