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
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Droplets,
  Ambulance,
  Boxes,
  Baby,
  Receipt,
  Wallet,
  ShieldCheck,
  House,
  ClipboardList,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { type Resource } from "@/server/auth/rbac";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** RBAC resource gating this item; omit for always-visible items. */
  resource?: Resource;
  /**
   * Roles that have API-level access to `resource` for some other purpose
   * (e.g. populating a picker elsewhere) but shouldn't see this as its own
   * nav destination.
   */
  hiddenForRoles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/home",               label: "Home",              icon: House },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/opd",                label: "OPD",               icon: Activity,        resource: "opd" },
      { href: "/patients",           label: "Patients",          icon: Users,           resource: "patients" },
      { href: "/doctors",            label: "Doctors",           icon: Stethoscope,     resource: "doctors" },
      { href: "/prescriptions",      label: "Prescriptions",     icon: FileText,        resource: "prescriptions" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/appointments",  label: "Appointments",  icon: Calendar,     resource: "appointments" },
      { href: "/pharmacy",      label: "Pharmacy",      icon: Pill,         resource: "pharmacy" },
      { href: "/lab",           label: "Lab",           icon: FlaskConical, resource: "lab" },
      { href: "/radiology",     label: "Radiology",     icon: ScanLine,     resource: "radiology" },
      { href: "/tasks",         label: "Task Board",    icon: ClipboardList, resource: "tasks" },
    ],
  },
  {
    label: "Inpatient",
    items: [
      { href: "/ipd",           label: "IPD",           icon: BedDouble,  resource: "ipd" },
      { href: "/ot",            label: "OT",            icon: Scissors,   resource: "ot" },
      { href: "/beds",          label: "Beds & Wards",  icon: LayoutGrid, resource: "beds" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/blood-bank",    label: "Blood Bank",    icon: Droplets,  resource: "bloodbank" },
      { href: "/ambulance",     label: "Ambulance",     icon: Ambulance, resource: "ambulance" },
      { href: "/inventory",     label: "Inventory",     icon: Boxes,     resource: "inventory" },
      { href: "/records",       label: "Birth & Death", icon: Baby,      resource: "records" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/billing",       label: "Billing",          icon: Receipt,     resource: "billing" },
      { href: "/finance",       label: "Income & Expense", icon: Wallet,      resource: "finance" },
      { href: "/tpa",           label: "TPA / Insurance",  icon: ShieldCheck, resource: "tpa" },
      { href: "/reports",       label: "Reports",          icon: BarChart3,   resource: "reports" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/staff",         label: "Staff",         icon: Users2,    resource: "staff", hiddenForRoles: ["Head Nurse"] },
      { href: "/admin",         label: "Admin Panel",   icon: Settings2, resource: "admin" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, can } = useAuth();

  // Until the session loads, show only the always-visible items to avoid a
  // full-navigation flash for restricted roles.
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.resource || (user ? can(item.resource) : false)) &&
          !item.hiddenForRoles?.includes(user?.role ?? ""),
      ),
    }))
    .filter((group) => group.items.length > 0);

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
        className="h-[52px] flex items-center shrink-0 px-[18px]"
        style={{ borderBottom: "1px solid #dedee1" }}
      >
        {collapsed ? (
          <Link href="/home" className="w-full flex items-center justify-center">
            <div className="w-[28px] h-[28px] rounded-[8px] bg-[#009598] flex items-center justify-center shrink-0">
              <span className="text-white text-[13px] font-medium">S</span>
            </div>
          </Link>
        ) : (
          <Link href="/home" className="flex items-center gap-[8px] flex-1 min-w-0">
            <div className="w-[28px] h-[28px] rounded-[8px] bg-[#009598] flex items-center justify-center shrink-0">
              <span className="text-white text-[13px] font-medium">S</span>
            </div>
            <span className="text-[17px] font-medium text-[#11111c] leading-tight whitespace-nowrap">
              Samvaad <span className="text-[#009598]">HMS</span>
            </span>
          </Link>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 flex flex-col gap-[6px]" style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}>
        {visibleGroups.map((group) => (
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
