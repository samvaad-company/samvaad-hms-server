"use client";

import { useEffect } from "react";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { applyTheme, MY_COLOR_KEY } from "@/lib/theme";

/** Keeps the app's brand colour in step with the hospital's chosen theme (Settings → Profile & branding). Renders nothing. */
export function ThemeApplier() {
  const { user } = useAuth();
  // Settings are readable by any signed-in user; the data is cached, so this costs nothing on most pages.
  const { item } = useItem<{ themeColor?: string }>(user?.hospitalId != null ? "/admin/settings" : null);
  const color = item?.themeColor;
  // A colour chosen on this device (Settings → Appearance) wins over the hospital's.
  useEffect(() => {
    let own: string | null = null;
    try { own = localStorage.getItem(MY_COLOR_KEY); } catch { /* none */ }
    const key = own || color;
    if (key) applyTheme(key);
  }, [color]);
  return null;
}
