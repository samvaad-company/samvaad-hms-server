"use client";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-center border-b border-[#dedee1] px-5 shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-[6px] px-4 py-[14px] text-[14px] font-normal border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === tab.id
              ? "border-[#009598] text-[#009598]"
              : "border-transparent text-[#57575f] hover:text-[#11111c]"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`text-[11px] px-[7px] py-[2px] rounded-full font-medium ${
                activeTab === tab.id
                  ? "bg-[#e8f7f7] text-[#009598]"
                  : "bg-[#f0f0f0] text-[#57575f]"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
