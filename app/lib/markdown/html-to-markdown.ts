/**
 * 渲染结果 → Markdown（所见即所得编辑器的反向转换）
 *
 * 这里的输入不是「干净的 HTML」，而是我们自己的渲染产物：
 * 代码块带行号与复制按钮、标题带锚点链接、数学公式是 KaTeX 的 DOM、
 * Mermaid 是占位块、提示框是 `<aside class="callout">`。
 *
 * 因此转换分两步：
 *  1. 在克隆出来的 DOM 上剔除装饰、把特殊块还原成可识别的形式
 *  2. 用 turndown + GFM 插件转成标准 Markdown
 *
 * 只有浏览器端会调用（依赖 DOM）。
 */
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export interface HtmlToMarkdownOptions {
  /** 代码块围栏语言 */
  fence?: string;
}

/** 从 KaTeX 产物里取回原始 TeX（KaTeX 会把源文本放进 annotation） */
function readTex(element: Element): string | null {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
  if (!annotation?.textContent) return null;
  return annotation.textContent.trim();
}

/**
 * 在 DOM 上清理渲染装饰，使其可以被 turndown 正确理解。
 * 直接修改传入的节点（调用方负责传入克隆）。
 */
export function prepareForMarkdown(root: Element): void {
  // 1. 标题锚点
  root.querySelectorAll(".heading-anchor").forEach((node) => node.remove());

  // 2. 代码块：整体替换为 <pre><code class="language-x">
  root.querySelectorAll(".code-wrapper").forEach((wrapper) => {
    const language = wrapper.getAttribute("data-lang") ?? "text";
    const scroll = wrapper.querySelector(".code-scroll") ?? wrapper;
    const lines = [...scroll.querySelectorAll("[data-line]")];
    const code =
      lines.length > 0
        ? lines.map((line) => line.textContent ?? "").join("\n")
        : (scroll.querySelector("pre code")?.textContent ?? "");
    const pre = root.ownerDocument.createElement("pre");
    const codeEl = root.ownerDocument.createElement("code");
    codeEl.className = `language-${language}`;
    codeEl.textContent = code.replace(/\n$/, "");
    pre.appendChild(codeEl);
    wrapper.replaceWith(pre);
  });

  // 3. Mermaid：还原为 ```mermaid 代码块
  root.querySelectorAll(".mermaid-block").forEach((block) => {
    const raw = block.getAttribute("data-mermaid") ?? "";
    let source = raw;
    try {
      source = decodeURIComponent(raw);
    } catch {
      // 保留原样
    }
    const pre = root.ownerDocument.createElement("pre");
    const codeEl = root.ownerDocument.createElement("code");
    codeEl.className = "language-mermaid";
    codeEl.textContent = source;
    pre.appendChild(codeEl);
    block.replaceWith(pre);
  });

  // 4. 提示框：还原为 `> [TYPE] 标题` 引用块
  root.querySelectorAll(".callout").forEach((callout) => {
    const type = (callout.getAttribute("data-callout") ?? "NOTE").toUpperCase();
    const title = callout.querySelector(".callout-title")?.textContent?.trim() ?? "";
    const body = callout.querySelector(".callout-body");
    const blockquote = root.ownerDocument.createElement("blockquote");
    const marker = title && title !== defaultCalloutLabel(type) ? ` ${title}` : "";
    const first = root.ownerDocument.createElement("p");
    first.textContent = `[${type}]${marker}`;
    blockquote.appendChild(first);
    if (body) {
      for (const child of [...body.childNodes]) blockquote.appendChild(child);
    }
    callout.replaceWith(blockquote);
  });

  // 5. 数学公式：行内/块级分别还原成 $…$ 与 $$…$$
  root.querySelectorAll(".katex-display").forEach((display) => {
    const tex = readTex(display);
    if (tex === null) return;
    const p = root.ownerDocument.createElement("p");
    p.textContent = `$$${tex}$$`;
    display.replaceWith(p);
  });
  root.querySelectorAll(".katex").forEach((inline) => {
    if (inline.closest(".katex-display")) return;
    const tex = readTex(inline);
    if (tex === null) return;
    inline.replaceWith(root.ownerDocument.createTextNode(`$${tex}$`));
  });

  // 6. 复制按钮 / 语言标签
  root.querySelectorAll("[data-code-copy], .code-lang").forEach((node) => node.remove());

  // 7. 图片灯箱标记（保留 img 本身）
  root.querySelectorAll("img").forEach((image) => {
    image.removeAttribute("loading");
    image.removeAttribute("decoding");
  });
}

const CALLOUT_LABELS: Record<string, string> = {
  NOTE: "注意",
  TIP: "提示",
  IMPORTANT: "重要",
  WARNING: "警告",
  CAUTION: "小心",
  DANGER: "危险",
};

function defaultCalloutLabel(type: string): string {
  return CALLOUT_LABELS[type] ?? "";
}

let service: TurndownService | null = null;

function getService(): TurndownService {
  if (service) return service;
  service = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
    br: "\n",
  });

  service.use(gfm);

  // 列表项前后不要多余空格（turndown 默认 "-   item"）
  service.addRule("listItemSpacing", {
    filter: "li",
    replacement: (content, node) => {
      const parent = node.parentNode as HTMLElement | null;
      const isOrdered = parent?.nodeName === "OL";
      const index = isOrdered
        ? [...(parent?.children ?? [])].indexOf(node as Element) + 1
        : null;
      const prefix = isOrdered ? `${index}. ` : "- ";
      const body = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
        .replace(/\n/gm, "\n  ");
      return `${prefix}${body}\n`;
    },
  });

  // 空段落不产生多余空行
  service.addRule("emptyParagraph", {
    filter: (node) => node.nodeName === "P" && !node.textContent?.trim(),
    replacement: () => "\n",
  });

  return service;
}

/**
 * 渲染后的 HTML → Markdown。
 *
 * @param html 渲染产物（与页面展示的完全一致）
 */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return "";

  prepareForMarkdown(root);
  const markdown = getService().turndown(root.innerHTML);

  return normalizeMarkdown(markdown);
}

/** 收尾：去尾随空格、压缩 3+ 空行 */
export function normalizeMarkdown(markdown: string): string {
  return `${markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
