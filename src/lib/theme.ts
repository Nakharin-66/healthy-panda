import { useEffect } from "react";

export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "hp_theme";

export const THEME_LABEL: Record<ThemePref, string> = {
  light: "สว่าง",
  dark: "มืด",
  system: "ตามระบบ",
};

export function normalizeTheme(value?: string | null): ThemePref {
  return value === "dark" || value === "system" ? value : "light";
}

export function applyTheme(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function storeTheme(pref: ThemePref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function readStoredTheme(): ThemePref {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "light";
  }
}

/** Keeps <html class="dark"> in sync with the stored/selected preference. */
export function useThemeSync(pref?: ThemePref) {
  useEffect(() => {
    const active = pref ?? readStoredTheme();
    applyTheme(active);
    if (active !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
}
