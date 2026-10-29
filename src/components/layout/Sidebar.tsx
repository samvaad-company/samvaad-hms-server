"use client";

import { memo, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Settings,
  ChevronDown,
  Inbox,
  ClipboardCheck,
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
  Sparkles,
  QrCode,
  CalendarCheck,
  CalendarClock,
  Video,
  HeartPulse,
  ListChecks,
  FolderSearch,
  FolderOpen,
  FileSignature,
  Biohazard,
  CalendarOff,
  Banknote,
  CalendarRange,
  BriefcaseBusiness,
  Layers,
  Building2,
  GitBranch,
  BadgeCheck,
  Gift,
  PillBottle,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCollapsedGroups } from "@/lib/sidebar-groups";
import { FULL_SCREEN_ROUTES } from "@/lib/layout-routes";
import Image from "next/image";
import logo from "../../../public/favicon.svg";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** RBAC resource gating this item; omit for always-visible items. */
  resource?: string;
  /**
   * Roles that have API-level access to `resource` for some other purpose
   * (e.g. populating a picker elsewhere) but shouldn't see this as its own
   * nav destination.
   */
  hiddenForRoles?: string[];
  /** Show only to these roles (a personal page that isn't a permission on a shared resource). */
  onlyForRoles?: string[];
  /** Active only on this exact path (not on pages below it): an overview page that sits above its siblings. */
  exact?: boolean;
  /** Single-key shortcut that opens this page (shown as a badge). Must be unique. */
  key?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/home",               label: "Home",              icon: House, key: "H" },
      { href: "/chat",                label: "AI Chat",           icon: Sparkles,    resource: "chat", key: "C" },
      { href: "/attendance-kiosk",    label: "Attendance QR",     icon: QrCode,      resource: "attendance", key: "Q" },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/opd",                label: "OPD",               icon: Activity,        resource: "opd", key: "O" },
      { href: "/patients",           label: "Patients",          icon: Users,           resource: "patients", key: "P" },
      { href: "/enquiries",          label: "Enquiries",         icon: Inbox,           resource: "enquiries", key: "3" },
      { href: "/followups",          label: "Follow-ups",        icon: ClipboardCheck,  resource: "followups", key: "4" },
      { href: "/doctors",            label: "Doctors",           icon: Stethoscope,     resource: "doctors", key: "D" },
      { href: "/prescriptions",      label: "Prescriptions",     icon: FileText,        resource: "prescriptions", key: "R" },
      { href: "/my-schedule",        label: "My Schedule",       icon: CalendarClock,   onlyForRoles: ["Doctor"], key: "Y" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/appointments",  label: "Appointments",  icon: Calendar,     resource: "appointments", key: "A" },
      { href: "/teleconsult",   label: "Video Consults", icon: Video,       resource: "teleconsult", key: "V" },
      { href: "/pharmacy",      label: "Pharmacy",      icon: Pill,         resource: "pharmacy", exact: true, key: "M" },
      { href: "/lab",           label: "Lab",           icon: FlaskConical, resource: "lab", key: "L" },
      { href: "/radiology",     label: "Radiology",     icon: ScanLine,     resource: "radiology", key: "X" },
      { href: "/tasks",         label: "Task Board",    icon: ClipboardList, resource: "tasks", key: "T" },
    ],
  },
  {
    label: "Inpatient",
    items: [
      { href: "/ipd",           label: "IPD",           icon: BedDouble,  resource: "ipd", key: "I" },
      { href: "/nurse-station", label: "Nurse Station", icon: HeartPulse, resource: "nursing", key: "6" },
      { href: "/checklists",    label: "Checklists",    icon: ListChecks, resource: "nursing", key: "5" },
      { href: "/ot",            label: "OT",            icon: Scissors,   resource: "ot", key: "U" },
      { href: "/beds",          label: "Beds & Wards",  icon: LayoutGrid, resource: "beds", key: "B" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/blood-bank",    label: "Blood Bank",    icon: Droplets,  resource: "bloodbank", key: "K" },
      { href: "/ambulance",     label: "Ambulance",     icon: Ambulance, resource: "ambulance", key: "E" },
      { href: "/records",       label: "Birth & Death", icon: Baby,      resource: "records", key: "W" },
    ],
  },
  {
    label: "Stores",
    items: [
      { href: "/inventory",     label: "Inventory",     icon: Boxes,     resource: "inventory", key: "N" },
      { href: "/cssd",          label: "CSSD",          icon: Biohazard, resource: "cssd", key: "-" },
      { href: "/pharmacy/dispense", label: "Dispense",  icon: PillBottle, resource: "pharmacy" },
    ],
  },
  {
    label: "MRD",
    items: [
      { href: "/file-tracking", label: "File tracking", icon: FolderSearch,   resource: "mrd", key: "7" },
      { href: "/documents",     label: "Documents",     icon: FolderOpen,     resource: "mrd", key: "8" },
      { href: "/signatures",    label: "Signatures",    icon: FileSignature,  resource: "consents", key: "9" },
      { href: "/mrd",           label: "MRD coding",    icon: ClipboardCheck, resource: "mrd", key: "0" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/billing",       label: "Billing",          icon: Receipt,     resource: "billing", key: "G" },
      { href: "/finance",       label: "Income & Expense", icon: Wallet,      resource: "finance", key: "F" },
      { href: "/tpa",           label: "TPA / Insurance",  icon: ShieldCheck, resource: "tpa", key: "J" },
      { href: "/reports",       label: "Reports",          icon: BarChart3,   resource: "reports", key: "S" },
    ],
  },
  {
    label: "HR",
    items: [
      { href: "/hr",            label: "HR overview",   icon: BriefcaseBusiness, resource: "hr", exact: true },
      { href: "/staff",         label: "Staff",         icon: Users2,    resource: "staff", hiddenForRoles: ["Head Nurse"], key: "Z" },
      { href: "/attendance",    label: "Attendance",    icon: CalendarCheck, resource: "staff", hiddenForRoles: ["Head Nurse"], key: "1" },
      { href: "/hr/leave",      label: "Leave",         icon: CalendarOff,   resource: "hr" },
      { href: "/hr/roster",     label: "Shifts & roster", icon: CalendarRange, resource: "hr" },
      { href: "/hr/payroll",    label: "Payroll",       icon: Banknote,  resource: "payroll" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin",         label: "Admin Panel",   icon: Settings2, resource: "admin", key: "2" },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/settings",       label: "Settings",       icon: Settings,   resource: "admin", key: "," },
      { href: "/masters",        label: "Masters",        icon: Layers,     resource: "admin" },
      { href: "/hospital-setup", label: "Hospital setup", icon: Building2,  resource: "admin" },
      { href: "/branches",       label: "Branches",       icon: GitBranch,  resource: "admin" },
      { href: "/plan",           label: "Plan & licence", icon: BadgeCheck, resource: "admin" },
      { href: "/refer",          label: "Refer & earn",   icon: Gift,       resource: "admin" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = memo(function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, can } = useAuth();
  const { collapsed: folded, toggle } = useCollapsedGroups();

  // Until the session loads, show only the always-visible items to avoid a
  // full-navigation flash for restricted roles.
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              (!item.resource || (user ? can(item.resource) : false)) &&
              !item.hiddenForRoles?.includes(user?.role ?? "") &&
              (!item.onlyForRoles || item.onlyForRoles.includes(user?.role ?? "")),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [user, can],
  );

  // Quick access: press an item's key (shown as its badge) to open it. Never while typing, with a dialog open,
  // with a modifier held, or on a full-screen form that has keys of its own.
  const router = useRouter();
  useEffect(() => {
    if (FULL_SCREEN_ROUTES.includes(pathname)) return;
    const targets = new Map<string, string>();
    for (const g of visibleGroups) for (const item of g.items) if (item.key) targets.set(item.key.toLowerCase(), item.href);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const href = targets.get(e.key.toLowerCase());
      if (!href) return;
      e.preventDefault();
      if (pathname !== href) router.push(href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleGroups, pathname, router]);

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 bg-[color:var(--chrome)] z-50 flex flex-col overflow-hidden"
      style={{
        width: collapsed ? 64 : 240,
        transition: "width 220ms ease",
        borderRight: "1px solid var(--chrome-line)",
      }}
    >
      {/* Logo + toggle */}
      <div
        className="h-[52px] flex items-center shrink-0 px-[18px]"
        style={{ borderBottom: "1px solid var(--chrome-line)" }}
      >
        {collapsed ? (
          <Link href="/home" className="w-full flex items-center justify-center">
            <div className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0">
              {/* <span className="text-white text-[13px] font-medium">S</span> */}
            <Image width={28} height={28} className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0" src={logo} alt="header logo" />
            </div>
          </Link>
        ) : (
          <Link href="/home" className="flex items-center gap-[8px] flex-1 min-w-0">
            {/* <div className="w-[28px] h-[28px] rounded-[8px] bg-[color:var(--brand)] flex items-center justify-center shrink-0">
              <span className="text-white text-[13px] font-medium">S</span>
            </div> */}

            <Image width={28} height={28} className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0" src={logo} alt="header logo" />
            <span className="text-[17px] font-medium text-[color:var(--ink)] leading-tight whitespace-nowrap">
              Samvaad <span className="text-[color:var(--brand)]">HMS</span>
            </span>
          </Link>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 flex flex-col gap-[6px]" style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}>
        {visibleGroups.map((group) => {
          const isFolded = !collapsed && folded.has(group.label);
          // A folded section still shows the page you are on, so you never lose your place.
          const shown = isFolded ? group.items.filter((item) => pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"))) : group.items;
          return (
          <div key={group.label} className="flex flex-col gap-[2px]">
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={!isFolded}
                title={isFolded ? `Show ${group.label}` : `Hide ${group.label}`}
                className="group/head flex items-center justify-between rounded-[6px] text-[12px] font-bold text-[color:var(--ink)] uppercase tracking-wider px-[14px] py-[7px] whitespace-nowrap cursor-pointer hover:text-[color:var(--brand)] transition-colors"
              >
                {group.label}
                <ChevronDown size={14} strokeWidth={1.5} className={`transition-transform duration-200 ${isFolded ? "-rotate-90" : ""}`} />
              </button>
            )}
            {collapsed && <div className="h-[1px] bg-[color:var(--line)] my-[6px] mx-1" />}
            {shown.map((item) => {
              const isActive = pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));
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
                        ? "bg-[color:var(--brand)] text-white"
                        : "text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)]"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                    {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    {!collapsed && item.key && (
                      <kbd className={`ml-auto min-w-[18px] text-center text-[10px] leading-[16px] font-mono rounded-[4px] px-[4px] border ${
                        isActive ? "border-white/40 text-white/90" : "border-[color:var(--chrome-line)] text-[color:var(--ink-soft)] bg-[color:var(--surface)]/60"
                      }`}>{item.key}</kbd>
                    )}
                  </Link>
                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-[10px] py-[6px] bg-[#11111c] text-white text-[12px] rounded-[6px] whitespace-nowrap pointer-events-none opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-[60] shadow-md">
                      {item.label}{item.key && <kbd className="ml-2 text-[10px] font-mono opacity-80">{item.key}</kbd>}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[color:var(--ink)]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Collapse toggle button */}
      <div className="shrink-0 px-3 pb-4">
        <button
          onClick={onToggle}
          className={`flex items-center rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors ${
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
});
