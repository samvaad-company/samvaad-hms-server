"use client";

import { useEffect } from "react";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { applyTheme } from "@/lib/theme";

/** Keeps the app's brand colour in step with the hospital's chosen theme (Settings → Profile & branding). Renders nothing. */
export function ThemeApplier() {
  const { user } = useAuth();
  // Settings are readable by any signed-in user; the data is cached, so this costs nothing on most pages.
  const { item } = useItem<{ themeColor?: string }>(user?.hospitalId != null ? "/admin/settings" : null);
  const color = item?.themeColor;
  useEffect(() => { if (color) applyTheme(color); }, [color]);
  return null;
}
