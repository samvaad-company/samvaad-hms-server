"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { RouteLoader } from "./RouteLoader";
import { FULL_SCREEN_ROUTES } from "@/lib/layout-routes";

/** Radius of the page's top-left corner, where it meets the sidebar and the header. */
const CORNER = 18;

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 240;
  const pathname = usePathname();
  const fullScreen = FULL_SCREEN_ROUTES.includes(pathname);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const top = fullScreen ? 0 : 52;

  return (
    <BreadcrumbProvider>
      {/* The app frame is fixed to the screen: sidebar and header never move, and the page panel below is the one
          place that scrolls (screens that manage their own panes, like Patients, fill it exactly instead). */}
      <div className="fixed inset-0 overflow-hidden bg-[color:var(--chrome)]">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        {!fullScreen && <TopBar sidebarLeft={sidebarWidth} />}
        <main
          id="app-scroll"
          className="absolute right-0 bottom-0 overflow-y-auto overscroll-contain bg-[color:var(--canvas)]"
          style={{
            left: sidebarWidth,
            top,
            borderTopLeftRadius: CORNER,
            transition: "left 220ms ease",
          }}
        >
          <div className="relative h-full">
            {children}
            <RouteLoader />
          </div>
        </main>
        {/* Keeps the rounded corner in place while the page scrolls underneath. */}
        <div
          aria-hidden
          className="fixed pointer-events-none z-[35]"
          style={{
            left: sidebarWidth,
            top,
            width: CORNER,
            height: CORNER,
            background: `radial-gradient(circle at ${CORNER}px ${CORNER}px, transparent ${CORNER - 0.5}px, var(--chrome) ${CORNER}px)`,
            transition: "left 220ms ease",
          }}
        />
        {!fullScreen && <ChatWidget />}
      </div>
    </BreadcrumbProvider>
  );
}
