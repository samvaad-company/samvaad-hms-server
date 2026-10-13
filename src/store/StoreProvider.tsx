"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./index";
import { invalidateAll } from "./cacheSlice";
import { setMutationListener } from "@/lib/api/client";

/** Refresh on returning to the tab only if it has been away this long. */
const REFOCUS_MS = 30_000;

/**
 * Owns the Redux store for the app. The store is created per mounted provider (not a
 * module global) so server renders never share state between visitors; all data loading
 * happens in the browser.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  useEffect(() => {
    // Any successful save → refresh every query that is on screen.
    setMutationListener(() => store.dispatch(invalidateAll()));

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > REFOCUS_MS) {
        hiddenAt = 0;
        store.dispatch(invalidateAll());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      setMutationListener(null);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
