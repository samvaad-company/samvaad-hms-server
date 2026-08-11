"use client";

/**
 * IT Admin home panel — system administration shortcuts.
 */
import { useAuth } from "@/lib/auth-context";
import { Settings2, ShieldCheck, Users2, BarChart3 } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, QuickLinks, MyTasksCard } from "./shared";

export function ItAdminPanel() {
  const { user } = useAuth();

  return (
    <>
      <PanelHeader name={user?.name ?? "Admin"} subtitle="System Administration · IT Panel" badge="Systems OK" />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="max-w-[720px]">
          <QuickLinks links={[
            { href: "/admin", label: "Hospital Settings",   description: "Name, tax, working hours",      icon: Settings2 },
            { href: "/admin", label: "Roles & Permissions", description: "Access control per role",       icon: ShieldCheck },
            { href: "/admin", label: "User Accounts",       description: "Manage logins & status",        icon: Users2 },
            { href: "/reports", label: "Reports",           description: "Usage & performance",           icon: BarChart3 },
          ]} />
        </div>
      </div>
      <MyTasksCard />
    </>
  );
}
