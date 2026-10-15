/**
 * Theme colours a hospital can choose (Settings → Profile & branding). The chosen colour becomes the
 * app's brand colour — buttons, links, the active sidebar item — for everyone at that hospital.
 *
 * Dependency-free: the API server reads THEME_KEYS from here too, so the two always agree.
 */
export const THEME_COLORS = [
  { key: "teal", label: "Teal", hex: "#009598" },
  { key: "cyan", label: "Cyan", hex: "#0e7490" },
  { key: "sky", label: "Sky", hex: "#1670a0" },
  { key: "blue", label: "Blue", hex: "#2f4ee0" },
  { key: "indigo", label: "Indigo", hex: "#4b32cf" },
  { key: "violet", label: "Violet", hex: "#6d1fe0" },
  { key: "purple", label: "Purple", hex: "#8a1fd0" },
  { key: "fuchsia", label: "Fuchsia", hex: "#b0159f" },
  { key: "pink", label: "Pink", hex: "#c0125e" },
  { key: "rose", label: "Rose", hex: "#c0143c" },
  { key: "red", label: "Red", hex: "#b81d24" },
  { key: "orange", label: "Orange", hex: "#bb4313" },
  { key: "amber", label: "Amber", hex: "#96560f" },
  { key: "yellow", label: "Yellow", hex: "#86640f" },
  { key: "lime", label: "Lime", hex: "#3f7014" },
  { key: "green", label: "Green", hex: "#0f7a36" },
  { key: "emerald", label: "Emerald", hex: "#0b7a57" },
  { key: "graphite", label: "Graphite", hex: "#1d1d22" },
] as const;

export type ThemeKey = (typeof THEME_COLORS)[number]["key"];

export const THEME_KEYS = THEME_COLORS.map((c) => c.key) as [ThemeKey, ...ThemeKey[]];
export const DEFAULT_THEME: ThemeKey = "teal";

/** Where the last-used colour is remembered, so the next page load paints in it straight away. */
export const THEME_STORAGE_KEY = "samvaad.themeHex";

export const themeHex = (key: string | null | undefined): string =>
  THEME_COLORS.find((c) => c.key === key)?.hex ?? THEME_COLORS[0].hex;

/** Make `key` the app's brand colour (the CSS variables in globals.css derive the shades from it). */
export function applyTheme(key: string | null | undefined): void {
  const hex = themeHex(key);
  document.documentElement.style.setProperty("--brand-base", hex);
  try { localStorage.setItem(THEME_STORAGE_KEY, hex); } catch { /* private mode: the colour just isn't remembered */ }
}

/** Inline script for <head>: restores the remembered colour and light/dark choice before the first paint (no flash). */
export const THEME_BOOT_SCRIPT =
  `try{var d=document.documentElement,c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  `if(c&&/^#[0-9a-f]{6}$/i.test(c))d.style.setProperty("--brand-base",c);` +
  `if(localStorage.getItem(${JSON.stringify("samvaad.mode")})==="dark")d.classList.add("dark")}catch(e){}`;
