"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { RouteLoader } from "./RouteLoader";

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 240;
  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-[#f7f7f7]">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <TopBar sidebarLeft={sidebarWidth} />
        <div className="relative min-h-screen" style={{ marginLeft: sidebarWidth, paddingTop: 52, transition: "margin-left 220ms ease" }}>
          {children}
          <RouteLoader />
        </div>
        <ChatWidget />
      </div>
    </BreadcrumbProvider>
  );
}
