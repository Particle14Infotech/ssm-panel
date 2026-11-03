"use client";

import React, { createContext, useContext, useEffect, useState, useTransition, useCallback } from "react";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "dark" | "light";
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
});

const COOKIE_NAME = "smm_theme";
const STORAGE_KEY = "smm_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const getSystemTheme = useCallback((): "dark" | "light" => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  const applyThemeToDOM = useCallback((activeMode: "dark" | "light", rawMode: ThemeMode) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;

    root.setAttribute("data-theme", activeMode);
    root.style.colorScheme = activeMode;

    if (activeMode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }

    // Accessibility overrides
    if (window.matchMedia("(prefers-contrast: more)").matches) {
      root.classList.add("contrast-more");
    } else {
      root.classList.remove("contrast-more");
    }

    if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) {
      root.classList.add("transparency-reduce");
    } else {
      root.classList.remove("transparency-reduce");
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    let saved: ThemeMode | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (!saved) {
        const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
        if (match) saved = decodeURIComponent(match[1]) as ThemeMode;
      }
    } catch {}

    const initialTheme: ThemeMode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const initialResolved = initialTheme === "system" ? getSystemTheme() : initialTheme;

    setThemeState(initialTheme);
    setResolvedTheme(initialResolved);
    applyThemeToDOM(initialResolved, initialTheme);
    setMounted(true);

    // System theme change listener
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      setThemeState((current) => {
        if (current === "system") {
          const newResolved = e.matches ? "dark" : "light";
          setResolvedTheme(newResolved);
          applyThemeToDOM(newResolved, "system");
        }
        return current;
      });
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [getSystemTheme, applyThemeToDOM]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      startTransition(() => {
        const nextResolved = mode === "system" ? getSystemTheme() : mode;
        setThemeState(mode);
        setResolvedTheme(nextResolved);

        try {
          localStorage.setItem(STORAGE_KEY, mode);
          document.cookie = `${COOKIE_NAME}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {}

        applyThemeToDOM(nextResolved, mode);
        window.dispatchEvent(new CustomEvent("smm-theme-change", { detail: { mode, resolved: nextResolved } }));
      });
    },
    [getSystemTheme, applyThemeToDOM]
  );

  const toggleTheme = useCallback(() => {
    // Quick toggle switches between explicit dark and light
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme: mounted ? theme : "system",
        resolvedTheme: mounted ? resolvedTheme : "dark",
        setTheme,
        toggleTheme,
        isDark: mounted ? resolvedTheme === "dark" : true,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
