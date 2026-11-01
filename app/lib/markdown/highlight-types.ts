/**
 * Markdown 高亮器类型与共享工具
 */

export interface HighlightRequest {
  code: string;
  lang: string;
  theme: { light: string; dark: string };
  /** 行号起始值（写入 data-line，供 CSS `attr(data-line)` 显示） */
  startLine: number;
}

/** 返回一段 `<pre class="shiki">…</pre>`；返回 null 表示该语言不可用 */
export type HighlightFn = (request: HighlightRequest) => Promise<string | null>;

/**
 * 主题别名：legacy config 使用 `github` / `github-dark`，
 * 而 shiki 内置主题名为 `github-light` / `github-dark`。
 */
const THEME_ALIASES: Record<string, string> = {
  github: "github-light",
  "github-default": "github-light",
  default: "github-light",
  dark: "github-dark",
  light: "github-light",
  "one-dark": "one-dark-pro",
};

export const FALLBACK_LIGHT_THEME = "github-light";
export const FALLBACK_DARK_THEME = "github-dark";

export function normalizeTheme(theme: string | undefined, fallback: string): string {
  if (!theme) return fallback;
  return THEME_ALIASES[theme] ?? theme;
}

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  plaintext: "text",
  txt: "text",
};

export function normalizeLang(lang: string): string {
  const lower = (lang || "text").toLowerCase().trim();
  return LANG_ALIASES[lower] ?? lower;
}

/**
 * 高亮结果的后处理：写入 data-lang 与行号偏移。
 * 两个高亮器共用，保证构建期与浏览器端输出一致。
 */
export function buildTransformers(lang: string, startLine: number) {
  return [
    {
      pre(node: { properties: Record<string, unknown> }) {
        node.properties = node.properties ?? {};
        node.properties["data-lang"] = lang;
        node.properties.className = [
          ...((node.properties.className as string[]) ?? []),
          "code-block",
        ];
      },
      line(node: { properties: Record<string, unknown> }, lineNumber: number) {
        node.properties = node.properties ?? {};
        node.properties["data-line"] = String(lineNumber + startLine - 1);
      },
    },
  ];
}
