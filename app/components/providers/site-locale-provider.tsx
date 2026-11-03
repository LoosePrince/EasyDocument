/**
 * 站点语言状态（只保存在浏览器 localStorage，不进入 URL）
 *
 * 位于 ConfigProvider 之上，因为 ConfigProvider 需要按站点语言选择
 * `config.locales[language]` 对应的站点配置。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const SITE_LANGUAGE_STORAGE_KEY = "easydocument:language";

export interface SiteLocaleValue {
  language: string;
  setLanguage: (code: string) => void;
  languages: Array<{ code: string; label: string }>;
}

const SiteLocaleContext = createContext<SiteLocaleValue | null>(null);

export function SiteLocaleProvider({
  siteLanguages,
  defaultLanguage,
  children,
}: {
  siteLanguages: Array<{ code: string; label: string }>;
  defaultLanguage: string;
  children: React.ReactNode;
}) {
  const languages = useMemo(
    () => siteLanguages.map((lang) => ({ code: lang.code, label: lang.label })),
    [siteLanguages],
  );
  const [language, setLanguageState] = useState(defaultLanguage);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY);
      if (stored && languages.some((lang) => lang.code === stored)) {
        setLanguageState(stored);
      }
    } catch {
      // 忽略存储失败
    }
  }, [languages]);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    try {
      window.localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, code);
    } catch {
      // 忽略存储失败
    }
  }, []);

  const value = useMemo<SiteLocaleValue>(
    () => ({ language, setLanguage, languages }),
    [language, languages, setLanguage],
  );

  return <SiteLocaleContext.Provider value={value}>{children}</SiteLocaleContext.Provider>;
}

export function useSiteLocale(): SiteLocaleValue {
  const value = useContext(SiteLocaleContext);
  if (!value) throw new Error("useSiteLocale 必须在 SiteLocaleProvider 内使用");
  return value;
}
