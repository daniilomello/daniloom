import { useEffect, useState } from "react";
import { BackgroundPattern, ThemeSettings } from "../types";
import { paletteTone } from "../theme/palettes";

const THEME_KEY = "daniloom_theme";
const PATTERNS: BackgroundPattern[] = ["dots", "solid", "grid", "radial"];

const defaults: ThemeSettings = {
  mode: "dark",
  background: "radial",
  palette: "chalk",
};

function readTheme(): ThemeSettings {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return { ...defaults, ...JSON.parse(saved) };
  } catch {
    // ignore
  }
  return defaults;
}

function applyPaletteVars(theme: ThemeSettings) {
  const tone = paletteTone(theme.palette, theme.mode);
  const root = document.documentElement;
  root.style.setProperty("--ds-primary", tone.primary);
  root.style.setProperty("--ds-primary-hover", tone.primaryHover);
  root.style.setProperty("--ds-on-primary", tone.onPrimary);
}

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  if (theme.mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }

  const patternClasses = PATTERNS.map((p) => `bg-pattern-${p}`);
  patternClasses.forEach((cls) => {
    document.body.classList.remove(cls);
    root.classList.remove(cls);
  });
  document.body.classList.add(`bg-pattern-${theme.background}`);
  root.classList.add(`bg-pattern-${theme.background}`);
  applyPaletteVars(theme);
}

export function useAppTheme() {
  const [theme, setTheme] = useState<ThemeSettings>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const updateTheme = (updates: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(THEME_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { theme, updateTheme };
}
