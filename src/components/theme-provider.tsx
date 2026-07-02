"use client";

import { createContext, useContext, useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const SUBscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  SUBscribers.add(callback);
  return () => SUBscribers.delete(callback);
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem("nl-theme") as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function emitChange() {
  SUBscribers.forEach((cb) => cb());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem("nl-theme", t);
    } catch {
      // ignore
    }
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    emitChange();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Apply theme class on mount + whenever it changes
  useApplyTheme(theme);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Separate hook that applies the DOM class — uses an effect but performs only
// an external (DOM) side effect, no setState, so it satisfies the linter.
import { useEffect } from "react";
function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    const prefersDarkStored = theme === "dark";
    // Inline head script already handles initial; here we keep it in sync.
    if (prefersDarkStored) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
