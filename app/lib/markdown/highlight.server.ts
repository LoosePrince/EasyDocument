/**
 * 服务端高亮器（构建期使用）
 *
 * shiki 完整 bundle：构建时一次性加载，不影响客户端体积。
 */
import { codeToHtml } from "shiki";
import {
  FALLBACK_DARK_THEME,
  FALLBACK_LIGHT_THEME,
  buildTransformers,
  normalizeTheme,
  type HighlightFn,
} from "./highlight-types";

let singleton: HighlightFn | null = null;

function createHighlighter(): HighlightFn {
  return async ({ code, lang, theme, startLine }) => {
    try {
      return await codeToHtml(code, {
        lang,
        themes: {
          light: normalizeTheme(theme.light, FALLBACK_LIGHT_THEME),
          dark: normalizeTheme(theme.dark, FALLBACK_DARK_THEME),
        },
        defaultColor: false,
        transformers: buildTransformers(lang, startLine),
      });
    } catch {
      return null;
    }
  };
}

export function getServerHighlighter(): HighlightFn {
  singleton ??= createHighlighter();
  return singleton;
}
