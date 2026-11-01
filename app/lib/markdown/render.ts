/**
 * Markdown 渲染管线（同构）
 *
 * 同一套代码在三个地方运行：
 *  - SSG 构建（Node）      → 预渲染 HTML
 *  - 编辑台实时预览（浏览器）→ 与最终页面完全一致的渲染
 *  - 单元测试
 *
 * 能力对齐 legacy `content-renderer.js`：
 *  - GFM（表格/任务列表/删除线/自动链接）
 *  - KaTeX 数学（$…$、$$…$$；跳过 code/pre）
 *  - 代码块：行号 + 起始行号 + 复制按钮 + shiki 高亮（高亮器由调用方注入）
 *  - 标题锚点 id（github-slugger，支持 CJK）
 *  - 警告框 `> [NOTE] 标题`
 *  - 内链改写为 /docs/...，外链加 target/rel，图片懒加载
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
import type { Root as HastRoot, Element } from "hast";
import { normalizeLang, type HighlightFn } from "./highlight-types";

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
  title?: string;
  firstH1?: string;
}

const CALLOUT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION", "DANGER"] as const;

type CalloutType = (typeof CALLOUT_TYPES)[number];

const CALLOUT_LABELS: Record<CalloutType, string> = {
  NOTE: "注意",
  TIP: "提示",
  IMPORTANT: "重要",
  WARNING: "警告",
  CAUTION: "小心",
  DANGER: "危险",
};

/** callout 图标（内联 SVG，不依赖图标字体） */
const CALLOUT_ICONS: Record<CalloutType, string> = {
  NOTE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  TIP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2Z"/></svg>',
  IMPORTANT:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  WARNING:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  CAUTION:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.4-4.6 1.5-6-1.5 0-3 .5-4 1.5S6 7 6 8.5c0 1 .3 1.8.7 2.5C5.1 11.8 4 13.4 4 15a4 4 0 0 0 4 4h1"/><path d="M12 10c1.2 1.5 2 3 2 4.5a2.5 2.5 0 0 1-5 0c0-1 .3-2 1-3"/></svg>',
  DANGER:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>',
};

interface PendingCode {
  raw: string;
  lang: string;
}

/**
 * 主入口：Markdown → HTML
 *
 * @param highlight 可选高亮器。不传则代码块以纯文本输出（仍带行号与复制按钮）。
 */
export async function renderMarkdown(
  markdown: string,
  options: MarkdownOptions,
  highlight?: HighlightFn,
): Promise<MarkdownResult> {
  const slugger = new GithubSlugger();
  const extracted = extractDocTitle(markdown);
  const codeBlocks: PendingCode[] = [];

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

  let html = String(await processor.process(markdown));

  if (codeBlocks.length > 0) {
    html = await replaceCodeBlocks(html, codeBlocks, options, highlight);
  }

  return { html, title: extracted.title, firstH1: extracted.firstH1 };
}

/** 从原始 Markdown 提取标题 */
export function extractDocTitle(markdown: string): { title?: string; firstH1?: string } {
  const h1 = markdown.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m);
  const h2 = markdown.match(/^\s{0,3}#{2}\s+(.+?)\s*#*\s*$/m);
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

    if (href.startsWith("#")) return;

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
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
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

  let relative = decoded;
  if (decoded.startsWith("/")) {
    relative = decoded.replace(/^\/+/, "");
    // 兼容 legacy 写法：/data/main/xxx
    if (relative.startsWith("data/")) relative = relative.slice("data/".length);
  }

  const docDir = options.docPath.includes("/")
    ? options.docPath.slice(0, options.docPath.lastIndexOf("/"))
    : "";

  const segments: string[] = decoded.startsWith("/") ? [] : docDir ? docDir.split("/") : [];
  for (const part of relative.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }

  let resolved = segments.join("/");

  // 已带 /docs/ 前缀 → 视为最终站点路径
  if (resolved === "docs" || resolved.startsWith("docs/")) {
    const rest = resolved.slice("docs".length).replace(/^\/+/, "");
    const [version, ...tail] = rest.split("/").filter(Boolean);
    if (version) {
      const target = ["docs", version, foldIndexAndExtension(tail.join("/"), options.indexPages)]
        .filter(Boolean)
        .join("/");
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

/** 收集代码块（渲染后按顺序替换为高亮结果） */
function collectCodeBlocks(tree: MdRoot, out: PendingCode[]) {
  visit(tree, "code", (node) => {
    out.push({ raw: node.value, lang: node.lang ?? "text" });
  });
}

/** `> [NOTE] 标题` → callout 卡片 */
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

    // 仅当首段只有一个文本节点且后面还有内容时，marker 后文字才作为自定义标题
    const isSimpleTitle = first.children.length === 1 && node.children.length > 1;
    const customTitle = match[2]?.trim();
    const title = isSimpleTitle && customTitle ? customTitle : CALLOUT_LABELS[type];

    if (isSimpleTitle) {
      node.children.shift();
    } else {
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
  });
}

function toPlainText(node: import("mdast").Node): string {
  if ("value" in node && typeof (node as { value: unknown }).value === "string") {
    return (node as { value: string }).value;
  }
  if ("children" in node) {
    const children = (node as { children: import("mdast").Node[] }).children;
    if (Array.isArray(children)) return children.map(toPlainText).join("");
  }
  return "";
}

/** 标题追加锚点链接 */
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
      properties: { href: `#${id}`, className: ["heading-anchor"], ariaLabel: "链接到此标题" },
      children: [{ type: "text", value: "#" }],
    });
  });
}

/** 图片懒加载 + 灯箱标记 */
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

/** 表格标记 */
function markTables(tree: HastRoot) {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "table") return;
    node.properties = node.properties ?? {};
    node.properties.className = [...((node.properties.className as string[]) ?? []), "doc-table"];
  });
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 按顺序把 `<pre><code>` 替换为高亮结果 */
async function replaceCodeBlocks(
  html: string,
  codeBlocks: PendingCode[],
  options: MarkdownOptions,
  highlight?: HighlightFn,
): Promise<string> {
  const rendered = await Promise.all(
    codeBlocks.map(async ({ raw, lang }) => {
      const normalizedLang = normalizeLang(lang);

      if (options.mermaid && normalizedLang === "mermaid") {
        return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(raw)}"><pre class="mermaid-source"><code>${escapeHtml(
          raw,
        )}</code></pre></div>`;
      }

      let body: string | null = null;
      if (highlight && options.highlight) {
        try {
          body = await highlight({
            code: raw,
            lang: normalizedLang,
            theme: options.codeBlock.theme,
            startLine: options.codeBlock.startLine,
          });
        } catch {
          body = null;
        }
      }

      return decorateCodeBlock(body ?? fallbackCode(raw), normalizeLang(lang), options);
    }),
  );

  let index = 0;
  return html.replace(/<pre><code(?:\s+class="[^"]*")?>[\s\S]*?<\/code><\/pre>/g, () =>
    rendered[index++] ?? "",
  );
}

function fallbackCode(raw: string): string {
  return `<pre class="shiki-fallback"><code>${escapeHtml(raw)}</code></pre>`;
}

/** 包装代码块：语言标签 + 复制按钮 + 行号 + 滚动容器 */
function decorateCodeBlock(body: string, lang: string, options: MarkdownOptions): string {
  const lineCount = (body.match(/class="line"/g) ?? []).length;
  const startLine = options.codeBlock.startLine;
  const lastLine = startLine + Math.max(lineCount - 1, 0);

  const copyButton = options.codeCopyButton
    ? `<button type="button" class="code-copy" data-code-copy aria-label="复制代码">复制</button>`
    : "";

  return `<div class="code-wrapper" data-lang="${escapeHtml(lang)}"${
    options.codeBlock.lineNumbers ? ' data-line-numbers="true"' : ""
  } data-start-line="${startLine}" data-end-line="${lastLine}">
<span class="code-lang">${escapeHtml(lang || "text")}</span>${copyButton}
<div class="code-scroll">${body}</div>
</div>`;
}

export { normalizeLang, normalizeTheme, FALLBACK_LIGHT_THEME, FALLBACK_DARK_THEME } from "./highlight-types";
export type { HighlightFn } from "./highlight-types";
