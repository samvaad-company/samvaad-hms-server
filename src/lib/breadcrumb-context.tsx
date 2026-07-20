"use client";

/**
 * Page chrome context: lets any page publish a breadcrumb (back link + title)
 * that the TopBar renders in its empty left region, instead of each page
 * drawing its own "Back to X" row.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface Breadcrumb {
  /** Back link target, e.g. "/patients". */
  href: string;
  /** Back link label, e.g. "Patients". */
  label: string;
  /** Current page title shown after the back link, e.g. "New Registration". */
  title?: string;
}

interface BreadcrumbContextValue {
  crumb: Breadcrumb | null;
  setCrumb: (crumb: Breadcrumb | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumb, setCrumb] = useState<Breadcrumb | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ crumb, setCrumb }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbValue(): Breadcrumb | null {
  return useContext(BreadcrumbContext)?.crumb ?? null;
}

/** Publish a breadcrumb to the TopBar for the lifetime of the page. */
export function useBreadcrumb(href: string, label: string, title?: string) {
  const ctx = useContext(BreadcrumbContext);
  const setCrumb = ctx?.setCrumb;
  useEffect(() => {
    if (!setCrumb) return;
    setCrumb({ href, label, title });
    return () => setCrumb(null);
  }, [setCrumb, href, label, title]);
}
