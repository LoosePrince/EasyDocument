/**
 * 全站国际化 Provider（v2.0.2）
 *
 * 两套语言互相独立：
 *  - 站点语言：界面文案，URL 位于 `/docs-{站点语言}/...`
 *  - 文档语言：文档内容，自动跟随站点语言，但也可以单独选择（不反向修改站点语言）
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { useSite } from "~/components/providers/config-provider";
import { useSiteLocale } from "~/components/providers/site-locale-provider";
import { docUrlPath, documentLanguageForSite, parseDocsUrl } from "~/lib/content/routes";
import { translate, type TranslateVars } from "./messages";

const DOC_STORAGE_KEY = "easydocument:document-language";

export interface I18nContextValue {
  /** 当前站点语言代码 */
  language: string;
  setLanguage: (code: string) => void;
  /** 切换站点语言；文档语言自动单向同步，文档页 URL 同步切换 */
  switchLanguage: (code: string) => void;
  /** 站点语言列表 */
  languages: Array<{ code: string; label: string }>;
  /** 当前文档语言 */
  documentLanguage: string;
  /** 单独切换文档语言；不改变站点语言 */
  switchDocumentLanguage: (code: string) => void;
  /** 文档语言列表（只有一个或关闭多语言时不显示切换项） */
  documentLanguages: Array<{ code: string; label: string }>;
  /** 是否显示文档语言列表 */
  documentSwitcherEnabled: boolean;
  /** 文案翻译（中文原文作 key） */
  t: (text: string, vars?: TranslateVars) => string;
  /** 是否显示站点语言切换器 */
  enabled: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 忽略存储失败
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { config } = useSite();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    language,
    setLanguage: setSiteLanguage,
    languages: siteLanguages,
  } = useSiteLocale();

  const documentLanguages = useMemo(
    () => config.i18n.document_languages.map((lang) => ({ code: lang.code, label: lang.label })),
    [config.i18n.document_languages],
  );
  const defaultLanguage = config.i18n.default_language;
  const defaultDocumentLanguage = config.i18n.default_document_language;
  const enabled =
    config.i18n.enable && config.i18n.switcher && siteLanguages.length > 1;
  const documentSwitcherEnabled =
    config.i18n.enable &&
    config.i18n.switcher &&
    config.i18n.document_mode !== "off" &&
    documentLanguages.length > 1;
  const uiEnabled = config.i18n.enable && config.i18n.ui;

  const [fallbackDocumentLanguage, setDocumentLanguageState] = useState(defaultDocumentLanguage);

  const routeInfo = useMemo(
    () => parseDocsUrl(location.pathname, config),
    [config, location.pathname],
  );

  // 站点语言只来自 localStorage；文档语言来自 URL
  const documentLanguage = routeInfo?.documentLanguage ?? fallbackDocumentLanguage;

  // 首次挂载读取本地文档语言（站点语言由 SiteLocaleProvider 管理）
  useEffect(() => {
    const storedDoc = readStored(DOC_STORAGE_KEY);
    if (storedDoc && documentLanguages.some((lang) => lang.code === storedDoc)) {
      setDocumentLanguageState(storedDoc);
    }
  }, [documentLanguages]);

  // 记住文档页上的文档语言，离开文档页后继续沿用
  useEffect(() => {
    if (!routeInfo) return;
    setDocumentLanguageState((current) =>
      current === routeInfo.documentLanguage ? current : routeInfo.documentLanguage,
    );
  }, [routeInfo]);

  const effectiveLanguage = uiEnabled ? language : defaultLanguage;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = effectiveLanguage;
    }
  }, [effectiveLanguage]);

  const setLanguage = useCallback(
    (code: string) => {
      setSiteLanguage(code);
    },
    [setSiteLanguage],
  );

  const setDocumentLanguage = useCallback((code: string) => {
    setDocumentLanguageState(code);
    writeStored(DOC_STORAGE_KEY, code);
  }, []);

  const switchLanguage = useCallback(
    (code: string) => {
      setLanguage(code);
      if (!config.i18n.enable) return;

      const nextDocumentLanguage = documentLanguageForSite(code, config.i18n);
      setDocumentLanguage(nextDocumentLanguage);

      const parsed = parseDocsUrl(location.pathname, config);
      if (!parsed) return;
      navigate(
        `${docUrlPath({
          branch: parsed.branch,
          path: parsed.path,
          documentLanguage: nextDocumentLanguage,
        })}${location.search}${location.hash}`,
      );
    },
    [config, location.hash, location.pathname, location.search, navigate, setDocumentLanguage, setLanguage],
  );

  const switchDocumentLanguage = useCallback(
    (code: string) => {
      if (!config.i18n.enable || config.i18n.document_mode === "off") return;
      setDocumentLanguage(code);
      const parsed = parseDocsUrl(location.pathname, config);
      if (!parsed) return;
      navigate(
        `${docUrlPath({
          branch: parsed.branch,
          path: parsed.path,
          documentLanguage: code,
        })}${location.search}${location.hash}`,
      );
    },
    [config, location.hash, location.pathname, location.search, navigate, setDocumentLanguage],
  );

  const t = useCallback(
    (text: string, vars?: TranslateVars) => translate(effectiveLanguage, text, vars),
    [effectiveLanguage],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      switchLanguage,
      languages: siteLanguages,
      documentLanguage,
      switchDocumentLanguage,
      documentLanguages,
      documentSwitcherEnabled,
      t,
      enabled,
    }),
    [
      documentLanguage,
      documentLanguages,
      documentSwitcherEnabled,
      enabled,
      language,
      setLanguage,
      siteLanguages,
      switchDocumentLanguage,
      switchLanguage,
      t,
    ],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n 必须在 I18nProvider 内使用");
  return value;
}

/** 便于在非组件环境读取默认语言 */
export function defaultUiLanguage(config: { i18n: { default_language: string } }): string {
  return config.i18n.default_language;
}
