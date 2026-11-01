/**
 * Markdown 渲染管线
 *
 * 对齐 legacy `content-renderer.js` 的能力：
 *  - GFM（表格/任务列表/删除线/自动链接）
 *  - KaTeX 数学（$…$、$$…$$；跳过 code/pre 内部）
 *  - 代码高亮（shiki，双主题）+ 行号 + 起始行号 + 复制按钮
 *  - 标题锚点 id（github-slugger，支持 CJK）
 *  - 警告框 `> [NOTE] 标题`
 *  - 内链改写为真实路径（/docs/...），外链加 target/rel
 *  - 图片灯箱包裹
 *
 * 输出 HTML 字符串；在 SSG 期生成，客户端直接渲染（可水合交互）
 */
import GithubSlugger from "github-slugger";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeKatex from "rehype-katex";
import { visit } from "unist-util-visit";
import type { Root as MdRoot, Heading, Html, Text } from "mdast";
import type { Root as HastRoot, Element, RootContent } from "hast";
import { codeToHtml } from "shiki";

export interface MarkdownOptions {
  /** 当前文档在分支内的路径，用于改写相对链接 */
  docPath: string;
  /** 当前版本名 */
  branch: string;
  /** 默认版本（用于相对链接目标版本判定） */
  defaultBranch: string;
  /** 全部已知版本名（用于识别链接里的版本前缀） */
  versions?: string[];
  /** 索引页文件名，用于折叠链接 */
  indexPages: string[];
  /** 允许的文档扩展名 */
  supportedExtensions: string[];
  /** 站点 base_url */
  baseUrl: string;
  /** 代码块设置 */
  codeBlock: {
    lineNumbers: boolean;
    startLine: number;
    theme: { light: string; dark: string };
  };
  codeCopyButton: boolean;
  math: boolean;
  highlight: boolean;
  mermaid: boolean;
}

export interface MarkdownResult {
  html: string;
  /** 提取出的标题（文档第一个 h1/h2），用于 SEO 与面包屑 */
  title?: string;
  /** 标题中出现的第一个 h1（若存在） */
  firstH1?: string;
}

const CALLOUT_TYPES = [
  "NOTE",
  "TIP",
  "IMPORTANT",
  "WARNING",
  "CAUTION",
  "DANGER",
] as const;

type CalloutType = (typeof CALLOUT_TYPES)[number];

const CALLOUT_META: Record<CalloutType, { label: string }> = {
  NOTE: { label: "注意" },
  TIP: { label: "提示" },
  IMPORTANT: { label: "重要" },
  WARNING: { label: "警告" },
  CAUTION: { label: "小心" },
  DANGER: { label: "危险" },
};

/**
 * 主入口：Markdown → HTML
 */
export async function renderMarkdown(
  markdown: string,
  options: MarkdownOptions,
): Promise<MarkdownResult> {
  const slugger = new GithubSlugger();
  const extracted = extractDocTitle(markdown);
  const codeBlocks: Array<{ raw: string; lang: string }> = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(options.math ? remarkMath : () => {})
    .use(() => (tree: MdRoot) => {
      rewriteLinks(tree, options);
      collectCodeBlocks(tree, codeBlocks);
      transformCallouts(tree);
      assignHeadingIds(tree, slugger);
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(options.math ? rehypeKatex : () => {})
    .use(() => (tree: HastRoot) => {
      enhanceHeadings(tree);
      wrapImages(tree);
      markTables(tree);
    })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const file = await processor.process(markdown);
  let html = String(file);

  if (options.highlight && codeBlocks.length > 0) {
    html = await highlightCodeBlocks(html, codeBlocks, options);
  }

  return { html, title: extracted.title, firstH1: extracted.firstH1 };
}

/** 从原始 Markdown 提取标题 */
export function extractDocTitle(markdown: string): { title?: string; firstH1?: string } {
  const h1 = markdown.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m);
  const h2 = markdown.match(/^\s{0,3}##\s+(.+?)\s*#*\s*$/m);
  const firstH1 = h1?.[1]?.trim();
  const title = firstH1 ?? h2?.[1]?.trim();
  return { title, firstH1 };
}

/** 重写链接：内链 → /docs/{branch}/...，外链加 target/rel */
function rewriteLinks(tree: MdRoot, options: MarkdownOptions) {
  visit(tree, "link", (node) => {
    const href = node.url;
    if (!href) return;

    if (isExternal(href)) {
      node.data = node.data ?? {};
      const existing = (node.data.hProperties as Record<string, unknown>) ?? {};
      const className = Array.isArray(existing.className)
        ? (existing.className as string[])
        : ["external-link"];
      node.data.hProperties = {
        ...existing,
        target: "_blank",
        rel: ["noopener", "noreferrer"],
        className,
      } as unknown as typeof node.data.hProperties;
      return;
    }

    if (href.startsWith("#")) return; // 页内锚点

    const { pathname, hash } = splitHref(href);
    if (!pathname) {
      node.url = hash ? `#${hash}` : href;
      return;
    }

    const resolved = resolveDocLink(pathname, options);
    node.url = resolved + (hash ? `#${hash}` : "");
  });
}

function isExternal(href: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("//")
  );
}

function splitHref(href: string): { pathname: string; hash: string } {
  const [beforeHash, hash = ""] = href.split("#");
  const [pathname] = beforeHash.split("?");
  return { pathname, hash };
}

/**
 * 相对链接 → 真实站点路径。
 * 规则与 legacy `fixInternalLinks` 等价，但输出目录式真实路径。
 */
export function resolveDocLink(rawPath: string, options: MarkdownOptions): string {
  const base = options.baseUrl === "/" ? "" : options.baseUrl;
  const decoded = safeDecode(rawPath).replace(/\\/g, "/");

  // 绝对站点路径：/main/使用指南/README.md 或 /docs/...
  let relative = decoded;
  if (decoded.startsWith("/")) {
    relative = decoded.replace(/^\/+/, "");
    // 兼容 legacy 写法：/data/main/xxx 或 /main/xxx
    const rootDir = "data";
    if (relative.startsWith(`${rootDir}/`)) relative = relative.slice(rootDir.length + 1);
  }

  const docDir = options.docPath.includes("/")
    ? options.docPath.slice(0, options.docPath.lastIndexOf("/"))
    : "";

  // 解析 . 与 ..
  const segments: string[] = decoded.startsWith("/")
    ? []
    : docDir
      ? docDir.split("/")
      : [];
  for (const part of relative.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }

  let resolved = segments.join("/");

  // 已带 /docs/ 前缀 → 视为最终站点路径，直接返回
  if (resolved === "docs" || resolved.startsWith("docs/")) {
    const rest = resolved.slice("docs".length).replace(/^\/+/, "");
    const [version, ...tail] = rest.split("/").filter(Boolean);
    if (version) {
      const folded = foldIndexAndExtension(tail.join("/"), options.indexPages);
      const target = ["docs", version, folded].filter(Boolean).join("/");
      return `${base}/${target}`.replace(/\/{2,}/g, "/");
    }
  }

  // 版本前缀：若链接未带版本，则沿用当前版本
  const firstSegment = resolved.split("/")[0];
  const knownVersionPrefixes = new Set([
    "main",
    options.branch,
    options.defaultBranch,
    ...(options.versions ?? []),
  ]);
  const hasVersionPrefix = knownVersionPrefixes.has(firstSegment) && resolved.includes("/");
  const version = hasVersionPrefix ? firstSegment : options.branch;
  if (hasVersionPrefix) resolved = resolved.split("/").slice(1).join("/");

  const target = ["docs", version, foldIndexAndExtension(resolved, options.indexPages)]
    .filter(Boolean)
    .join("/");
  return `${base}/${target}`.replace(/\/{2,}/g, "/");
}

/** 去扩展名 + 索引页折叠 */
function foldIndexAndExtension(path: string, indexPages: string[]): string {
  const withoutExt = path.replace(/\.(md|markdown|html?)$/i, "");
  const parts = withoutExt.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const indexNames = indexPages.map((name) => name.replace(/\.(md|html?)$/i, "").toLowerCase());
  if (parts.length && indexNames.includes(last.toLowerCase())) parts.pop();
  return parts.join("/");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 收集代码块，供 shiki 统一高亮 */
function collectCodeBlocks(tree: MdRoot, out: Array<{ raw: string; lang: string }>) {
  visit(tree, "code", (node) => {
    out.push({ raw: node.value, lang: node.lang ?? "text" });
  });
}

/** `> [NOTE] 标题` → callout card */
function transformCallouts(tree: MdRoot) {
  visit(tree, "blockquote", (node, index, parent) => {
    if (index === undefined || !parent) return;
    const first = node.children[0];
    if (!first || first.type !== "paragraph") return;
    const firstChild = first.children[0];
    if (!firstChild || firstChild.type !== "text") return;

    const match = (firstChild as Text).value.match(/^\s*\[([A-Z]+)\]\s*([\s\S]*)$/);
    if (!match) return;
    const type = match[1] as CalloutType;
    if (!CALLOUT_TYPES.includes(type)) return;

    const meta = CALLOUT_META[type];

    // 只有当「首个段落仅由一个文本节点构成」时，才把 marker 后的文字当作自定义标题；
    // 否则（段落里还有 `code`、**粗体** 等内联节点）整体视为正文，避免标题与正文重复。
    const isSimpleTitle = first.children.length === 1 && node.children.length > 1;
    const customTitle = match[2]?.trim();
    const title = isSimpleTitle && customTitle ? customTitle : meta.label;

    if (isSimpleTitle) {
      // 整个首段就是标题行，移除它
      node.children.shift();
    } else {
      // 仅剥离 `[TYPE]` 标记，保留段落其余内容作为正文
      const prefixLength = (firstChild as Text).value.length - match[2].length;
      (firstChild as Text).value = (firstChild as Text).value
        .slice(prefixLength)
        .replace(/^\s+/, "");
      if (!(firstChild as Text).value.trim()) first.children.shift();
      if (first.children.length === 0) node.children.shift();
    }

    const html: Html = {
      type: "html",
      value: `<aside class="callout callout-${type.toLowerCase()}" data-callout="${type}"><p class="callout-title"><span class="callout-icon" aria-hidden="true">${CALLOUT_ICONS[type]}</span>${escapeHtml(
        title,
      )}</p><div class="callout-body">`,
    };
    const closing: Html = { type: "html", value: "</div></aside>" };

    parent.children.splice(index, 1, html, ...node.children, closing);
  });
}

/** callout 图标（lucide 路径内联，避免运行时依赖） */
const CALLOUT_ICONS: Record<CalloutType, string> = {
  NOTE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  TIP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2Z"/></svg>',
  IMPORTANT:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  WARNING:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  CAUTION:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.4-4.6 1.5-6-1.5 0-3 .5-4 1.5S6 7 6 8.5c0 1 .3 1.8.7 2.5C5.1 11.8 4 13.3 4 15a4 4 0 0 0 4 4h1"/><path d="M12 10c1.2 1.5 2 3 2 4.5a2.5 2.5 0 0 1-5 0c0-1 .3-2 1-3"/></svg>',
  DANGER:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>',
};

/** 标题 id（github-slugger，CJK 友好） */
function assignHeadingIds(tree: MdRoot, slugger: GithubSlugger) {
  visit(tree, "heading", (node: Heading) => {
    const text = toPlainText(node);
    const id = slugger.slug(text || "section");
    node.data = node.data ?? {};
    node.data.hProperties = {
      ...(node.data.hProperties as Record<string, unknown>),
      id,
    };
    node.data.hName = node.data.hName ?? `h${node.depth}`;
  });
}

function toPlainText(node: import("mdast").Node): string {
  if ("value" in node && typeof (node as { value: unknown }).value === "string") {
    return (node as { value: string }).value;
  }
  if ("children" in node && Array.isArray((node as { children: unknown }).children)) {
    return ((node as { children: import("mdast").Node[] }).children).map(toPlainText).join("");
  }
  return "";
}

/** 标题增强：包一层锚点链接 */
function enhanceHeadings(tree: HastRoot) {
  visit(tree, "element", (node: Element) => {
    if (!/^h[1-6]$/.test(node.tagName)) return;
    const id = (node.properties?.id as string) || undefined;
    if (!id) return;
    node.properties = node.properties ?? {};
    node.properties.className = [...((node.properties.className as string[]) ?? []), "heading-anchor-host"];
    node.children.push({
      type: "element",
      tagName: "a",
      properties: {
        href: `#${id}`,
        className: ["heading-anchor"],
        ariaLabel: "链接到此标题",
      },
      children: [{ type: "text", value: "#" }],
    });
  });
}

/** 图片包裹（灯箱） */
function wrapImages(tree: HastRoot) {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "img") return;
    node.properties = node.properties ?? {};
    const existing = (node.properties.className as string[]) ?? [];
    node.properties.className = [...existing, "doc-image"];
    node.properties.loading = node.properties.loading ?? "lazy";
    node.properties.decoding = node.properties.decoding ?? "async";
  });
}

/** 表格包裹，便于横向滚动 */
function markTables(tree: HastRoot) {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "table") return;
    node.properties = node.properties ?? {};
    node.properties.className = [...((node.properties.className as string[]) ?? []), "doc-table"];
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 代码高亮
 *
 * mdast 阶段已把代码块收集到 codeBlocks，这里把 `<pre><code>` 依次替换为
 * shiki 输出（双主题 CSS 变量），并附加行号与复制按钮。
 */
async function highlightCodeBlocks(
  html: string,
  codeBlocks: Array<{ raw: string; lang: string }>,
  options: MarkdownOptions,
): Promise<string> {
  const rendered = await Promise.all(
    codeBlocks.map(async ({ raw, lang }) => {
      const normalizedLang = normalizeLang(lang);
      if (options.mermaid && normalizedLang === "mermaid") {
        const encoded = encodeURIComponent(raw);
        return `<div class="mermaid-block" data-mermaid="${encoded}"><pre class="mermaid-source"><code>${escapeHtml(raw)}</code></pre></div>`;
      }
      try {
        return await codeToHtml(raw, {
          lang: normalizedLang,
          themes: {
            light: normalizeTheme(options.codeBlock.theme.light, FALLBACK_LIGHT_THEME),
            dark: normalizeTheme(options.codeBlock.theme.dark, FALLBACK_DARK_THEME),
          },
          defaultColor: false,
          transformers: [
            {
              pre(node) {
                node.properties = node.properties ?? {};
                node.properties["data-lang"] = normalizedLang;
                node.properties.className = [
                  ...((node.properties.className as string[]) ?? []),
                  "code-block",
                ];
              },
              line(node, line) {
                node.properties = node.properties ?? {};
                node.properties["data-line"] = String(line + options.codeBlock.startLine - 1);
              },
            },
          ],
        });
      } catch (error) {
        console.error("[easydocument] shiki 高亮失败:", normalizedLang, error);
        return `<pre class="code-block fallback"><code>${escapeHtml(raw)}</code></pre>`;
      }
    }),
  );

  let index = 0;
  return html.replace(/<pre><code(?:\s+class="[^"]*")?>[\s\S]*?<\/code><\/pre>/g, () => {
    const block = rendered[index++] ?? "";
    return decorateCodeBlock(block, options);
  });
}

function decorateCodeBlock(html: string, options: MarkdownOptions): string {
  const langMatch = html.match(/data-lang="([^"]*)"/);
  const lang = langMatch?.[1] ?? "";
  const lineCount = (html.match(/class="line"/g) ?? []).length;
  const startLine = options.codeBlock.startLine;
  const lastLine = startLine + Math.max(lineCount - 1, 0);

  const lineNumbers =
    options.codeBlock.lineNumbers && lineCount > 0
      ? `<span class="code-lines" aria-hidden="true">${Array.from(
          { length: lineCount },
          (_, i) => `<span>${startLine + i}</span>`,
        ).join("")}</span>`
      : "";

  const copyButton = options.codeCopyButton
    ? `<button type="button" class="code-copy" data-code-copy aria-label="复制代码">复制</button>`
    : "";

  return `<div class="code-wrapper" data-lang="${escapeHtml(lang)}"${
    options.codeBlock.lineNumbers ? ' data-line-numbers="true"' : ""
  } data-start-line="${startLine}" data-end-line="${lastLine}">
<span class="code-lang">${escapeHtml(lang || "text")}</span>${copyButton}
${lineNumbers}
<div class="code-scroll">${html}</div>
</div>`;
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
  html: "html",
  text: "text",
  plaintext: "text",
  txt: "text",
};

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
  oneDark: "one-dark-pro",
  "one-dark": "one-dark-pro",
};

const FALLBACK_LIGHT_THEME = "github-light";
const FALLBACK_DARK_THEME = "github-dark";

function normalizeLang(lang: string): string {
  const lower = (lang || "text").toLowerCase().trim();
  return LANG_ALIASES[lower] ?? lower;
}

function normalizeTheme(theme: string | undefined, fallback: string): string {
  if (!theme) return fallback;
  return THEME_ALIASES[theme] ?? theme;
}

/** 供类型检查使用的占位（保持 RootContent 引用不丢失） */
export type { RootContent };
