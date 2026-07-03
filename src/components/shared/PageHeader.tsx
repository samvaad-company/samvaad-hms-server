import { type LucideIcon, Calendar, ChevronDown, Plus } from "lucide-react";
import { StatPill } from "./StatPill";

interface StatItem {
  icon: LucideIcon;
  value: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  subtitle: string;
  stats: StatItem[];
  action: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
  };
  dateRange?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  stats,
  action,
  dateRange = true,
}: PageHeaderProps) {
  const ActionIcon = action.icon ?? Plus;

  return (
    <div className="flex items-start justify-between px-[30px] pt-[16px] pb-[12px]">
      <div className="flex flex-col gap-[2px]">
        <h1 className="text-[24px] font-medium text-[#11111c] leading-[28px] capitalize">
          {title}
        </h1>
        <p className="text-[13px] font-light text-[#57575f] leading-[17px] whitespace-nowrap">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-[10px] mt-[2px] shrink-0">
        {stats.map((s, i) => (
          <StatPill key={i} {...s} />
        ))}

        {dateRange && (
          <div className="bg-white flex items-center gap-[10px] px-[15px] py-[6px] rounded-full cursor-pointer">
            <div className="flex items-center gap-[5px]">
              <Calendar size={24} strokeWidth={1.5} className="text-[#11111c]" />
              <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">
                1 Nov -30 Nov
              </span>
            </div>
            <div className="w-px h-4 bg-[#dedee1]" />
            <div className="flex items-center gap-[5px]">
              <span className="text-[14px] font-normal text-[#11111c] leading-[19px]">
                Last 30 days
              </span>
              <ChevronDown size={15} strokeWidth={2} className="text-[#11111c]" />
            </div>
          </div>
        )}

        <button
          onClick={action.onClick}
          className="bg-[#009598] flex items-center gap-[5px] px-[15px] py-[6px] rounded-full cursor-pointer hover:bg-[#007f82] transition-colors"
        >
          <ActionIcon size={24} strokeWidth={1.5} className="text-white" />
          <span className="text-[14px] font-normal text-white leading-[19px] whitespace-nowrap">
            {action.label}
          </span>
        </button>
      </div>
    </div>
  );
}
