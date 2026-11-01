/**
 * 浏览器端文档渲染器
 *
 * 与构建期完全同一套管线（renderMarkdown + 同一个高亮器契约），
 * 因此编辑预览与最终页面逐字节一致。
 *
 * 注意：高亮器在首次渲染时才初始化，避免服务端构建期求值浏览器模块。
 */
import { renderMarkdown, type MarkdownOptions } from "./render";
import type { HighlightFn } from "./highlight-types";
import { extractTocFromHtml } from "./toc";
import type { TocHeading } from "~/components/toc/table-of-contents";

export interface PreviewRenderInput {
  markdown: string;
  docPath: string;
  branch: string;
  defaultBranch: string;
  versions: string[];
  indexPages: string[];
  supportedExtensions: string[];
  baseUrl: string;
  codeBlock: { lineNumbers: boolean; startLine: number; theme: { light: string; dark: string } };
  codeCopyButton: boolean;
  math: boolean;
  highlight: boolean;
  mermaid: boolean;
  tocNumbering: boolean;
  tocIgnoreH1: boolean;
}

export interface PreviewRenderResult {
  html: string;
  toc: TocHeading[];
  title?: string;
}

let highlighterPromise: Promise<HighlightFn> | null = null;
let pending: { key: string; promise: Promise<PreviewRenderResult> } | null = null;

async function resolveHighlighter(): Promise<HighlightFn> {
  if (typeof window === "undefined") {
    // 构建期（prerender）不会用到预览；返回空实现保证不报错
    return async () => null;
  }
  highlighterPromise ??= import("./highlight.client").then((mod) => mod.getBrowserHighlighter());
  return highlighterPromise;
}

/** 预热高亮引擎（打开编辑器时调用，降低首次输入延迟） */
export function warmPreviewRenderer() {
  if (typeof window === "undefined") return;
  void import("./highlight.client").then((mod) => mod.preloadHighlighter());
}

export async function renderPreview(input: PreviewRenderInput): Promise<PreviewRenderResult> {
  const key = `${input.docPath}|${input.branch}|${input.markdown}`;
  // 相同输入复用上一次结果（避免预览抖动）
  if (pending?.key === key) return pending.promise;

  const options: MarkdownOptions = {
    docPath: input.docPath,
    branch: input.branch,
    defaultBranch: input.defaultBranch,
    versions: input.versions,
    indexPages: input.indexPages,
    supportedExtensions: input.supportedExtensions,
    baseUrl: input.baseUrl,
    codeBlock: input.codeBlock,
    codeCopyButton: input.codeCopyButton,
    math: input.math,
    highlight: input.highlight,
    mermaid: input.mermaid,
  };

  const promise = (async () => {
    let highlight: HighlightFn | undefined;
    if (input.highlight) {
      try {
        highlight = await resolveHighlighter();
      } catch {
        highlight = undefined;
      }
    }

    const result = await renderMarkdown(input.markdown, options, highlight);
    return {
      html: result.html,
      title: result.title,
      toc: extractTocFromHtml(result.html, {
        tocNumbering: input.tocNumbering,
        tocIgnoreH1: input.tocIgnoreH1,
      }),
    };
  })();

  pending = { key, promise };
  return promise;
}
