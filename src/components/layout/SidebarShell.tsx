"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-[#f7f7f7]">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <TopBar sidebarLeft={sidebarWidth} />
        <div style={{ marginLeft: sidebarWidth, paddingTop: 52, transition: "margin-left 220ms ease" }}>
          {children}
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
