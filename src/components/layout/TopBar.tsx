"use client";

import { useState } from "react";
import { Search, Settings, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface TopBarProps {
  sidebarLeft: number;
}

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TopBar({ sidebarLeft }: TopBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
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
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-[8px] cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-[#b8d9d9] flex items-center justify-center shrink-0">
              <span className="text-[13px] font-medium text-[#009598]">
                {user ? initials(user.name) : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-[2px] items-start">
              <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">
                {user?.name ?? "Loading…"}
              </span>
              <span className="text-[12px] font-light text-[#57575f] leading-4">
                {user?.role ?? ""}
              </span>
            </div>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-[48px] z-50 w-[200px] bg-white rounded-[12px] border border-[#dedee1] shadow-lg py-2">
                <div className="px-4 py-2 border-b border-[#f0f0f0]">
                  <p className="text-[13px] font-medium text-[#11111c] truncate">{user?.name}</p>
                  <p className="text-[11px] font-light text-[#57575f] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors"
                >
                  <LogOut size={16} strokeWidth={1.5} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
