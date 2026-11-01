/**
 * 文档 URL 生成
 *
 * 规则（与 legacy hash 路由语义一一对应，但改为真实路径）：
 *   /docs/{version}/{path}
 *
 * - 版本 = data 分支下的子目录名；默认版本也不省略，保证可预测性
 * - 扩展名去掉；索引页归一为目录路径
 *     main/README.md              → /docs/main
 *     使用指南/README.md          → /docs/main/使用指南
 *     使用指南/基本使用流程.md    → /docs/main/使用指南/基本使用流程
 * - 锚点：/docs/...#标题-id
 */
import type { DocsNode } from "../content/types";
import type { ResolvedConfig } from "../config/types";
import { normalizeSlashes } from "../content/pointer";
import { stripExtension } from "../content/types";

export interface DocRoute {
  branch: string;
  /** 分支内路径，"" 表示版本根 */
  path: string;
  anchor?: string;
}

/**
 * URL 段编码：只转义真正的保留字符，保留 CJK 等可读字符
 * （与 GitHub Pages / 浏览器地址栏显示一致，避免路径变成一长串 %E4%B8...）
 */
export function encodeSegments(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.replace(/[%#?&=+ ]/g, (char) => encodeURIComponent(char)),
    )
    .join("/");
}

export function joinUrl(...parts: Array<string | undefined>): string {
  const joined = parts.filter(Boolean).join("/");
  return joined.replace(/\/{2,}/g, "/");
}

/** 把分支内文件路径归一为 URL 路径段（去扩展名、索引页折叠） */
export function normalizeDocPath(
  filePath: string,
  indexPages: string[],
  branch = "",
): DocRoute {
  const clean = normalizeSlashes(filePath);
  const withoutExt = stripExtension(clean);
  const segments = withoutExt.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const indexNames = indexPages.map((name) => stripExtension(name).toLowerCase());
  if (segments.length > 0 && indexNames.includes(last.toLowerCase())) {
    segments.pop();
  }
  return { branch, path: segments.join("/") };
}

/** 文档 URL 的路径部分（不含 base_url） */
export function docUrlPath(route: DocRoute, anchor?: string): string {
  const segments = ["docs", route.branch, route.path].filter(
    (segment) => segment !== undefined && segment !== null && segment !== "",
  );
  const path = `/${segments
    .map((segment) => (segment === "docs" ? segment : encodeSegments(segment)))
    .join("/")}`;
  const normalized = path.replace(/\/{2,}/g, "/");
  return anchor ? `${normalized}#${anchor}` : normalized;
}

/** 完整 URL（含 base_url 前缀），用于 <a href> */
export function docHref(
  route: DocRoute,
  config: Pick<ResolvedConfig, "site">,
  anchor?: string,
): string {
  const base = config.site.base_url === "/" ? "" : config.site.base_url;
  const path = docUrlPath(route, anchor);
  return base ? `${base}${path}` : path;
}

/** 站点内其他路径加 base_url */
export function siteHref(path: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith("mailto:") || path.startsWith("//")) {
    return path;
  }
  const base = baseUrl === "/" ? "" : baseUrl;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${clean}` : clean;
}

/**
 * 旧版站点路径升级（v1 的 `main/`、`main/#路径/`、`/data/main/路径` 写法）
 *
 * v1 文档页是 `main/#/路径`；v1 config 里的导航/按钮链接多为
 *   "main/"、"main/#快速入门/"、"/main/#使用指南/"
 * 在 v2 中的等价物是 `/docs/{版本}/{路径}`。
 * 仅当首段命中已知版本名时才改写，避免误伤普通路径。
 */
export function upgradeLegacyPath(path: string, versions: string[]): string {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith("mailto:") || path.startsWith("//")) {
    return path;
  }

  // 已符合 v2 结构，直接返回
  if (/^\/?docs(\/|$)/.test(path)) return path;

  let working = path.replace(/^\/+/, "");
  // 兼容 /data/ 前缀
  if (working.startsWith("data/")) working = working.slice("data/".length);

  const known = new Set(versions.filter(Boolean));
  if (known.size === 0) return path;

  // main/#快速入门/ 或 main/#/快速入门/
  const hashMatch = working.match(/^([^/#?]+)\/?#\/?(.*)$/);
  const versionSegment = hashMatch ? hashMatch[1] : working.split("/")[0];
  if (!known.has(versionSegment)) return path;

  const rest = hashMatch
    ? `/${hashMatch[2] ?? ""}`
    : working.slice(versionSegment.length).replace(/^\/+/, "");

  const cleaned = rest
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/\.(md|markdown|html?)$/i, "")
    .replace(/\/+$/, "");

  const query = path.includes("?") ? path.slice(path.indexOf("?")) : "";

  const target = ["docs", versionSegment, cleaned].filter(Boolean).join("/");
  return `/${target}${query}`;
}

/** 侧栏中定位当前节点：把「当前文档路径」映射到应高亮的节点 */
export function findActiveNode(root: DocsNode, docPath: string): DocsNode | null {
  const target = normalizeSlashes(docPath);
  let result: DocsNode | null = null;

  const visit = (node: DocsNode) => {
    if (result) return;
    if (node.index?.path === target || node.path === target) {
      result = node;
      return;
    }
    for (const child of node.children) visit(child);
  };

  visit(root);
  return result;
}

export interface PrevNext {
  prev: { path: string; title: string } | null;
  next: { path: string; title: string } | null;
}

/** 上一篇/下一篇（文档顺序与侧栏一致） */
export function buildPrevNext(docs: Array<{ path: string; title: string }>, current: string): PrevNext {
  const index = docs.findIndex((doc) => doc.path === current);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? docs[index - 1] : null,
    next: index < docs.length - 1 ? docs[index + 1] : null,
  };
}
