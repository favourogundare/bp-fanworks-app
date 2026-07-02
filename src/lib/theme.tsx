import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";

// Kept in sync by hand with the literal in index.html's pre-hydration script —
// that inline script can't import this constant, so if you rename this key,
// update index.html too or the flash-prevention script will silently stop working.
const STORAGE_KEY = "bpf-theme";

function getStoredTheme(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null; // storage blocked (privacy mode, enterprise policy, sandboxed iframe, etc.)
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const ThemeContext = createContext<{ mode: ThemeMode; toggleTheme: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme() ?? (systemPrefersDark() ? "dark" : "light"));
  const [hasExplicit, setHasExplicit] = useState<boolean>(() => getStoredTheme() !== null);

  // Follow the OS theme live, but only until the member makes an explicit choice.
  useEffect(() => {
    if (hasExplicit) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setMode(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hasExplicit]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // storage blocked — theme still applies for this session, just won't persist
      }
      return next;
    });
    setHasExplicit(true);
  };

  return <ThemeContext.Provider value={{ mode, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
