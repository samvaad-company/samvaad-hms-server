"use client";

import { Search, Settings, Bell } from "lucide-react";

interface TopBarProps {
  sidebarLeft: number;
}

export function TopBar({ sidebarLeft }: TopBarProps) {
  return (
    <div
      className="fixed top-0 z-40 h-[78px] bg-[#f7f7f7] flex items-center justify-end px-8"
      style={{ left: sidebarLeft, right: 0, borderBottom: "1px solid #dedee1", transition: "left 220ms ease" }}
    >
      <div className="flex items-center gap-5">
        {/* Search */}
        <button className="bg-white rounded-full p-2 flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.08)] cursor-pointer hover:bg-[#f6f6f6] transition-colors">
          <Search size={24} strokeWidth={1.5} className="text-[#11111c]" />
        </button>

        {/* Settings + Bell */}
        <div className="bg-white rounded-full flex items-center gap-3 px-[10px] py-2 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <Settings size={24} strokeWidth={1.5} className="text-[#11111c] cursor-pointer" />
          <div className="w-px h-4 bg-[#dedee1]" />
          <Bell size={24} strokeWidth={1.5} className="text-[#11111c] cursor-pointer" />
        </div>

        {/* User */}
        <div className="flex items-center gap-[8px]">
          <div className="w-9 h-9 rounded-full bg-[#b8d9d9] flex items-center justify-center shrink-0">
            <span className="text-[13px] font-medium text-[#009598]">KC</span>
          </div>
          <div className="flex flex-col gap-[2px]">
            <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">
              Dr. Kevin Carter
            </span>
            <span className="text-[12px] font-light text-[#57575f] leading-4">
              Admin
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
