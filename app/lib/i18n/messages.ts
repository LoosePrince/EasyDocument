/**
 * 界面文案字典（v2.0.2）
 *
 * 以中文原文作为 key，英文等语言提供映射。没有映射时自动回落中文，
 * 因此新增界面文案不会出现空白。
 */
import type { ResolvedConfig } from "~/lib/config/types";
import en from "../../../lang/en.json";

export type TranslateVars = Record<string, string | number | undefined>;



export const MESSAGES: Record<string, Record<string, string>> = {
  en,
};

/** 是否中文语言 */
export function isChinese(language: string): boolean {
  return /^zh(\b|-|_)/i.test(language) || language.toLowerCase() === "zh";
}

/** 取界面语言（未启用翻译时强制中文） */
export function uiLanguage(config: ResolvedConfig, language: string): string {
  if (!config.i18n.enable || !config.i18n.ui) return config.i18n.default_language;
  return language;
}

export function translate(
  language: string,
  text: string,
  vars?: TranslateVars,
): string {
  const template = isChinese(language) ? text : (MESSAGES[language]?.[text] ?? MESSAGES.en[text] ?? text);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });
}
