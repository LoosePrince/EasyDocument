import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyTheme, getStoredTheme, resolveTheme, setTheme, type ThemeMode } from "~/lib/theme";

interface ThemeContextValue {
  theme: ThemeMode;
  toggle: () => void;
  set: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  defaultMode,
  children,
}: {
  defaultMode: "auto" | "light" | "dark";
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => resolveTheme(defaultMode));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 跟随系统变化（仅在用户未手动选择时）
  useEffect(() => {
    if (getStoredTheme()) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        const next: ThemeMode = event.matches ? "dark" : "light";
        setThemeState(next);
        applyTheme(next);
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      setTheme(next);
      return next;
    });
  }, []);

  const set = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    setTheme(mode);
  }, []);

  const value = useMemo(() => ({ theme, toggle, set }), [theme, toggle, set]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return value;
}
