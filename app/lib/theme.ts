/**
 * 主题控制（暗色模式）
 *
 * 优先级：localStorage.theme > config.appearance.default_dark_mode > 系统
 */
export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "easydocument:theme";

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function resolveTheme(defaultMode: "auto" | "light" | "dark"): ThemeMode {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (defaultMode === "light" || defaultMode === "dark") return defaultMode;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: ThemeMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  applyTheme(theme);
}

/** 在 <head> 内尽早执行，避免闪烁（由 root.tsx 内联脚本调用） */
export function buildThemeInitScript(defaultMode: "auto" | "light" | "dark"): string {
  // 用户手动选择优先；否则按配置默认值；auto 跟随系统
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});var d=${JSON.stringify(defaultMode)};var dark=s==="dark"||(s===null&&(d==="dark"||(d==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches)));document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
}

/** 兼容旧调用：默认 auto */
export const THEME_INIT_SCRIPT = buildThemeInitScript("auto");
