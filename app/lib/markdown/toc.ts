/**
 * 从渲染后的 HTML 中提取目录（标题列表）。
 *
 * 与 legacy `generateToc` 等价，但在构建期完成，输出结构化数据：
 *  - depth > toc_depth 的标题被保留但标记，由 dynamicExpand 决定显示
 *  - 编号按 toc_numbering / toc_ignore_h1 计算（1、1.2、1.2.3）
 */
import type { TocHeading } from "~/components/toc/table-of-contents";

export interface ExtractTocOptions {
  tocNumbering: boolean;
  tocIgnoreH1: boolean;
}

export function extractTocFromHtml(html: string, options: ExtractTocOptions): TocHeading[] {
  const headingRegex = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g;
  const headings: TocHeading[] = [];
  const counters: number[] = [0, 0, 0, 0, 0, 0];
  let currentAnchor = "";
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    const depth = Number(match[1]);
    const attrs = match[2];
    const idMatch = attrs.match(/\bid\s*=\s*("([^"]*)"|'([^']*)')/);
    const id = idMatch ? (idMatch[2] ?? idMatch[3]) : undefined;
    if (!id) continue;

    const text = decodeHtml(stripTags(stripAnchor(match[3]))).trim();
    if (!text) continue;

    if (depth <= 2 || currentAnchor === "") currentAnchor = id;

    const number = options.tocNumbering ? computeNumber(counters, depth, options.tocIgnoreH1) : undefined;

    headings.push({
      id,
      text,
      depth,
      number,
      anchorId: currentAnchor === id ? undefined : currentAnchor,
    });
  }

  return headings;
}

function computeNumber(counters: number[], depth: number, ignoreH1: boolean): string | undefined {
  const index = depth - 1;
  const offset = ignoreH1 ? 1 : 0;
  if (ignoreH1 && depth === 1) return undefined;

  counters[index] += 1;
  for (let i = index + 1; i < counters.length; i += 1) counters[i] = 0;

  const parts = counters.slice(offset, index + 1).filter((_, i) => i + offset <= index);
  const effective = parts.length > 0 ? parts : [counters[index]];
  if (effective.every((value) => value === 0)) return undefined;
  return effective.map((value) => (value === 0 ? 1 : value)).join(".");
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

/** 去掉 rehype-autolink 追加的 # 锚点 */
function stripAnchor(input: string): string {
  return input.replace(/<a[^>]*class="heading-anchor"[^>]*>[\s\S]*?<\/a>/g, "");
}

function decodeHtml(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}
