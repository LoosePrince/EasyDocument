/**
 * 浏览器端高亮器（编辑预览 / 客户端重渲染）
 *
 * shiki web bundle：只含常用语言与主题，语言按需加载。
 * 行号依赖 CSS `attr(data-line)`，因此 data-line 需带起始偏移（与构建期一致）。
 */
import type { HighlighterCore } from "shiki/core";
import type { HighlightFn } from "./highlight-types";
import {
  FALLBACK_DARK_THEME,
  FALLBACK_LIGHT_THEME,
  buildTransformers,
  normalizeTheme,
} from "./highlight-types";

let engine: Promise<HighlighterCore> | null = null;

function loadEngine(): Promise<HighlighterCore> {
  engine ??= import("shiki/bundle/web").then((shiki) =>
    shiki.createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [],
    }),
  );
  return engine;
}

export function preloadHighlighter() {
  return loadEngine();
}

export function getBrowserHighlighter(): HighlightFn {
  return async ({ code, lang, theme, startLine }) => {
    try {
      const highlighter = await loadEngine();

      if (!highlighter.getLoadedLanguages().includes(lang)) {
        try {
          await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0]);
        } catch {
          return null;
        }
      }

      return highlighter.codeToHtml(code, {
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
