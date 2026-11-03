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
  /**
   * 文档语言（v2.0.2）。URL 形如 `/docs-{documentLanguage}/{branch}/...`；
   * 省略时保留旧 `/docs/...`（供测试与兼容调用）。
   */
  documentLanguage?: string;
  /** @deprecated 兼容旧调用，等价于 documentLanguage */
  language?: string;
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

/** 默认索引页名（与 config 默认值一致） */
export const DEFAULT_INDEX_NAMES = ["readme", "index"];

/**
 * 文档 URL 的路径部分（不含 base_url）
 *
 * 这里再做一次「索引页折叠」兜底：即使调用方传入了未折叠的
 * `参考/README`（只去了扩展名），也会得到 `/docs/main/参考`，
 * 避免侧栏/面包屑生成指向不存在页面的链接。
 */
export function docUrlPath(route: DocRoute, anchor?: string): string {
  const normalizedRoutePath = foldIndexSegment(route.path);
  const documentLanguage = route.documentLanguage ?? route.language;
  const segments: string[] = [
    documentLanguage ? `docs-${encodeSegments(documentLanguage)}` : "docs",
  ];
  if (route.branch) segments.push(route.branch);
  if (normalizedRoutePath) segments.push(normalizedRoutePath);

  const path = `/${segments.map((segment) => encodeSegments(segment)).join("/")}`;
  const normalized = path.replace(/\/{2,}/g, "/");
  return anchor ? `${normalized}#${anchor}` : normalized;
}

/** 把结尾的 `README` / `index` 段去掉 */
export function foldIndexSegment(path: string): string {
  const parts = (path || "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (DEFAULT_INDEX_NAMES.includes(last.toLowerCase())) parts.pop();
  return parts.join("/");
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
 * 把已经生成的 /docs-{默认文档语言}/... 链接换成当前文档语言。
 * 站点语言只在 localStorage，不进入 URL。
 */
export function withDocumentLanguage(
  href: string,
  documentLanguage: string,
  defaultDocumentLanguage: string,
): string {
  if (!documentLanguage || documentLanguage === defaultDocumentLanguage) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return href
    .replace(/\/docs-[^/]+/, `/docs-${documentLanguage}`)
    .replace(/\/docs(?=\/|$)/, `/docs-${documentLanguage}`);
}

/**
 * 解析站内文档 URL（v2.0.2）
 *
 *   /docs-zh-CN/main/使用指南   → 文档语言 zh-CN，path=使用指南
 *   /docs-en/main/使用指南      → 文档语言 en，path=使用指南
 *   /docs/main/使用指南         → legacy：文档语言 = 默认文档语言
 *
 * 站点语言只保存在 localStorage，不参与 URL。
 */
export function parseDocsUrl(
  pathname: string,
  config: Pick<ResolvedConfig, "site" | "i18n">,
): {
  branch: string;
  documentLanguage: string;
  explicitDocumentLanguage: boolean;
  path: string;
  legacy: boolean;
} | null {
  const base = config.site.base_url === "/" ? "" : config.site.base_url;
  let clean = pathname || "/";
  if (base && (clean === base || clean.startsWith(`${base}/`))) {
    clean = clean.slice(base.length) || "/";
  }

  const match = clean.match(/^\/(docs(?:-[^/]+)?)(?:\/(.*))?$/);
  if (!match) return null;

  const docsSegment = match[1];
  let explicitDocumentLanguage = false;
  let documentLanguage = config.i18n.default_document_language;
  let legacy = false;

  if (docsSegment.startsWith("docs-")) {
    explicitDocumentLanguage = true;
    try {
      documentLanguage = decodeURIComponent(docsSegment.slice("docs-".length));
    } catch {
      documentLanguage = docsSegment.slice("docs-".length);
    }
    if (!config.i18n.document_languages.some((lang) => lang.code === documentLanguage)) {
      documentLanguage = config.i18n.default_document_language;
    }
  } else {
    legacy = true;
  }

  const rawSegments = (match[2] ?? "").split("/").filter(Boolean);
  const segments = rawSegments.map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  const branch = segments[0] ?? "";
  const path = segments.slice(1).join("/");

  return {
    branch,
    documentLanguage,
    explicitDocumentLanguage,
    path,
    legacy,
  };
}

/** 站点语言自动单向同步到文档语言；站点语言没有文档时回落到默认文档语言 */
export function documentLanguageForSite(
  siteLanguage: string,
  i18n: Pick<ResolvedConfig, "i18n">["i18n"],
): string {
  if (!i18n.enable || i18n.document_mode === "off") {
    return i18n.default_document_language;
  }
  return i18n.document_languages.some((lang) => lang.code === siteLanguage)
    ? siteLanguage
    : i18n.default_document_language;
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
