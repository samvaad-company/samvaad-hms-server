"use client";

/**
 * The loading indicator for first visits. Data that is already in the Redux store
 * shows instantly, so this only appears while a page waits on data it has never
 * loaded: a thin progress bar at the top (any first load) and a centred spinner
 * over the page content until the page's initial data has arrived.
 *
 * Once a page has settled, later first loads (a dialog opening, a picker) only
 * move the progress bar — they don't blank the page again.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAppSelector } from "@/store";

/** If nothing starts loading within this long after navigating, the page is fully served from the store. */
const GRACE_MS = 350;

export function RouteLoader() {
  const pending = useAppSelector((s) => s.apiCache.pendingFirstLoads);
  const pathname = usePathname();
  const [settledPath, setSettledPath] = useState<string | null>(null);
  const sawLoad = useRef<string | null>(null);

  useEffect(() => {
    if (settledPath === pathname) return;
    if (pending > 0) { sawLoad.current = pathname; return; }
    if (sawLoad.current === pathname) { setSettledPath(pathname); return; }
    const t = setTimeout(() => setSettledPath(pathname), GRACE_MS);
    return () => clearTimeout(t);
  }, [pending, pathname, settledPath]);

  const showPage = pending > 0 && settledPath !== pathname;

  return (
    <>
      {pending > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] overflow-hidden pointer-events-none" role="progressbar" aria-label="Loading">
          <div className="h-full w-1/3 bg-[#009598] animate-[hms-bar_1.1s_ease-in-out_infinite]" />
        </div>
      )}
      {showPage && (
        <div className="absolute inset-0 z-30 bg-[#f7f7f7]" aria-busy="true">
          <div className="sticky top-[38vh] flex flex-col items-center gap-3 text-[#57575f]">
            <Loader2 size={30} strokeWidth={1.5} className="animate-spin text-[#009598]" />
            <span className="text-[13px]">Loading…</span>
          </div>
        </div>
      )}
    </>
  );
}
