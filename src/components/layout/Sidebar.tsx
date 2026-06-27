"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Users,
  Stethoscope,
  FileText,
  Calendar,
  Pill,
  FlaskConical,
  BedDouble,
  Scissors,
  LayoutGrid,
  Users2,
  BarChart3,
  Settings2,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Clinical",
    items: [
      { href: "/opd",                label: "OPD",               icon: Activity },
      { href: "/patients",           label: "Patients",          icon: Users },
      { href: "/doctors",            label: "Doctors",           icon: Stethoscope },
      { href: "/doctors/dashboard",  label: "Doctor Dashboard",  icon: LayoutDashboard },
      { href: "/prescriptions",      label: "Prescriptions",     icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/appointments",  label: "Appointments",  icon: Calendar },
      { href: "/pharmacy",      label: "Pharmacy",      icon: Pill },
      { href: "/lab",           label: "Lab",           icon: FlaskConical },
    ],
  },
  {
    label: "Inpatient",
    items: [
      { href: "/ipd",           label: "IPD",           icon: BedDouble },
      { href: "/ot",            label: "OT",            icon: Scissors },
      { href: "/beds",          label: "Beds & Wards",  icon: LayoutGrid },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/staff",         label: "Staff",         icon: Users2 },
      { href: "/reports",       label: "Reports",       icon: BarChart3 },
      { href: "/admin",         label: "Admin Panel",   icon: Settings2 },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 bg-white z-50 flex flex-col overflow-hidden"
      style={{
        width: collapsed ? 64 : 240,
        transition: "width 220ms ease",
        borderRight: "1px solid #dedee1",
      }}
    >
      {/* Logo + toggle */}
      <div
        className="h-[78px] flex items-center shrink-0 px-[18px]"
        style={{ borderBottom: "1px solid #dedee1" }}
      >
        {collapsed ? (
          <div className="w-full flex items-center justify-center">
            <div className="w-[28px] h-[28px] rounded-[8px] bg-[#009598] flex items-center justify-center shrink-0">
              <span className="text-white text-[13px] font-medium">S</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-[8px] flex-1 min-w-0">
            <div className="w-[28px] h-[28px] rounded-[8px] bg-[#009598] flex items-center justify-center shrink-0">
              <span className="text-white text-[13px] font-medium">S</span>
            </div>
            <span className="text-[17px] font-medium text-[#11111c] leading-tight whitespace-nowrap">
              Samvaad <span className="text-[#009598]">HMS</span>
            </span>
          </div>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-[6px]" style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}>
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-[2px]">
            {!collapsed && (
              <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider px-[14px] py-[6px] whitespace-nowrap">
                {group.label}
              </span>
            )}
            {collapsed && <div className="h-[1px] bg-[#dedee1] my-[6px] mx-1" />}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <div key={item.href} className="relative group/nav">
                  <Link
                    href={item.href}
                    className={`flex items-center rounded-[8px] transition-colors ${
                      collapsed
                        ? "justify-center p-[9px]"
                        : "gap-[10px] px-[14px] py-[9px] text-[14px] font-normal leading-[19px]"
                    } ${
                      isActive
                        ? "bg-[#009598] text-white"
                        : "text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c]"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                    {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-[10px] py-[6px] bg-[#11111c] text-white text-[12px] rounded-[6px] whitespace-nowrap pointer-events-none opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-[60] shadow-md">
                      {item.label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#11111c]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle button */}
      <div className="shrink-0 px-3 pb-4">
        <button
          onClick={onToggle}
          className={`flex items-center rounded-[8px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors ${
            collapsed ? "w-full justify-center p-[9px]" : "w-full gap-[10px] px-[14px] py-[9px] text-[14px]"
          }`}
        >
          {collapsed ? (
            <ChevronRight size={20} strokeWidth={1.5} />
          ) : (
            <>
              <ChevronLeft size={20} strokeWidth={1.5} />
              <span className="whitespace-nowrap">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
