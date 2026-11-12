"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useIsCompact } from "@/lib/use-media-query";
import { useTableLabels } from "./useTableLabels";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { LoyaltyRankProvider } from "@/components/loyalty/PatientName";
import { RouteLoader } from "./RouteLoader";
import { TourProvider } from "@/components/training/TourProvider";
import { LiveAppointmentsListener } from "@/components/live/LiveAppointmentsListener";
import { LiveToasts } from "@/components/live/LiveToasts";
import { FULL_SCREEN_ROUTES } from "@/lib/layout-routes";

/** Width of the AI drawer when it sits beside the page. */
const AI_WIDTH = 400;

/** Radius of the page's top-left corner, where it meets the sidebar and the header. */
const CORNER = 18;

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [collapsedPref, setCollapsed] = useState(false);
  // The AI drawer on the right: open or closed from the top bar, kept as you move between screens.
  const [aiOpen, setAiOpen] = useState(false);
  // Phones and tablets: the sidebar is a drawer over the page (never a rail), opened from the top bar.
  const compact = useIsCompact();
  const collapsed = collapsedPref && !compact;
  useTableLabels(compact);
  const sidebarWidth = collapsed ? 64 : 240;
  const pathname = usePathname();
  const fullScreen = FULL_SCREEN_ROUTES.includes(pathname);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  const toggleAi = useCallback(() => setAiOpen((o) => !o), []);
  // The drawer is open for the page it was opened on, so navigating closes it without an effect.
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const drawerOpen = compact && drawerFor === pathname;
  const openDrawer = useCallback(() => setDrawerFor(pathname), [pathname]);
  const closeDrawer = useCallback(() => setDrawerFor(null), []);

  const top = fullScreen ? 0 : 52;

  return (
    <BreadcrumbProvider>
      <TourProvider>
      <LoyaltyRankProvider>
      <LiveAppointmentsListener />
      <LiveToasts />
      {/* The app frame is fixed to the screen: sidebar and header never move, and the page panel below is the one
          place that scrolls (screens that manage their own panes, like Patients, fill it exactly instead). */}
      <div
        className="fixed inset-0 overflow-hidden bg-[color:var(--chrome)]"
        style={{ "--sb-w": `${sidebarWidth}px`, "--ai-w": `${aiOpen && !fullScreen ? AI_WIDTH : 0}px` } as React.CSSProperties}
      >
        <Sidebar collapsed={collapsed} onToggle={toggle} drawerOpen={drawerOpen} onCloseDrawer={closeDrawer} />
        {!fullScreen && <TopBar onOpenMenu={openDrawer} aiOpen={aiOpen} onToggleAi={toggleAi} />}
        {/* Full-screen forms have no top bar, so they get their own menu button on small screens. */}
        {fullScreen && (
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open menu"
            className="lg:hidden fixed left-3 top-3 z-40 w-10 h-10 rounded-full bg-[color:var(--surface)] shadow-md flex items-center justify-center text-[color:var(--ink)]"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
        )}
        <main
          id="app-scroll"
          className="absolute right-0 lg:right-[var(--ai-w)] bottom-0 left-0 lg:left-[var(--sb-w)] overflow-y-auto overscroll-contain bg-[color:var(--canvas)] transition-[left,right] duration-[220ms] ease-in-out lg:rounded-tl-[18px]"
          style={{ top }}
        >
          <div className="relative h-full">
            {children}
            {/* Breathing room under the last card of every page (a page that fills the whole height hides it: see globals.css). */}
            <div aria-hidden data-page-end className="h-6 shrink-0" />
            <RouteLoader />
          </div>
        </main>
        {/* Keeps the rounded corner in place while the page scrolls underneath. */}
        <div
          aria-hidden
          className="hidden lg:block fixed pointer-events-none z-[35] left-[var(--sb-w)] transition-[left] duration-[220ms] ease-in-out"
          style={{
            top,
            width: CORNER,
            height: CORNER,
            background: `radial-gradient(circle at ${CORNER}px ${CORNER}px, transparent ${CORNER - 0.5}px, var(--chrome) ${CORNER}px)`,
          }}
        />
        {!fullScreen && <ChatWidget open={aiOpen} onOpenChange={setAiOpen} />}
      </div>
      </LoyaltyRankProvider>
      </TourProvider>
    </BreadcrumbProvider>
  );
}
