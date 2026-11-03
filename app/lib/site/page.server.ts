/**
 * 文档页数据装配（构建期执行）
 *
 * v2.0.2：同一版本可包含多个语言变体，URL 里的语言段决定使用哪一份树与文档。
 */
import { loadSiteData, getLanguageData, type SiteData } from "../site/load.server";
import { normalizeSlashes } from "../content/pointer";
import { docKind, stripExtension, type DocsNode, type GitInfo } from "../content/types";
import { collectDocPaths } from "../content/types";
import { normalizeDocPath } from "../content/routes";
import { languageLabel } from "../content/language";
import { renderMarkdown } from "../markdown/render";
import { getServerHighlighter } from "../markdown/highlight.server";
import { extractTocFromHtml, type ExtractTocOptions } from "../markdown/toc";
import type { TocHeading } from "~/components/toc/table-of-contents";

export interface DocPageData {
  branch: string;
  branchLabel: string;
  /** 文档语言（URL 中 /docs-{language}/ 的部分） */
  documentLanguage: string;
  documentLanguageLabel: string;
  /** @deprecated 兼容旧组件：等同于 documentLanguage */
  language: string;
  /** @deprecated 兼容旧组件：等同于 documentLanguageLabel */
  languageLabel: string;
  /** 该文档语言没有译文，实际展示默认语言内容 */
  fallbackLanguage?: boolean;
  /** 逻辑路径，如 "使用指南/README.md" */
  docPath: string;
  /** 实际文件路径，如 "en/使用指南/README.md" */
  sourcePath: string;
  title: string;
  kind: "markdown" | "html";
  /** Markdown 渲染结果；HTML 文档为空（原样注入） */
  html: string;
  /** 原文（Markdown 或 HTML），供就地编辑器使用 */
  source: string;
  /** 构建期 git 信息（无则隐藏） */
  git?: GitInfo;
  /** HTML 文档的原始内容（原样注入，不做「安全」限制） */
  rawHtml?: string;
  toc: TocHeading[];
  tree: DocsNode;
  prev: { path: string; title: string } | null;
  next: { path: string; title: string } | null;
  /** 面包屑（从版本根到当前目录）；linkable=false 表示该目录没有索引页 */
  breadcrumbs: Array<{ title: string; path: string; linkable?: boolean }>;
  editUrl?: string;
  canonicalPath: string;
  /** 外部挂载文档：内容来源地址（运行时按需拉取） */
  externalUrl?: string;
  /** 外部挂载文档：所属仓库 */
  externalRepo?: string;
}

export interface DocPageRequest {
  branch: string;
  /** URL 中的路径段（未解码） */
  splat: string;
  /** 文档语言（来自 /docs-{documentLanguage}/... 路由参数；旧链接省略） */
  documentLanguage?: string;
}

export interface BranchLandingData {
  branch: string;
  branchLabel: string;
  documentLanguage: string;
  documentLanguageLabel: string;
  tree: DocsNode;
  docs: Array<{ path: string; title: string }>;
}

export type DocRouteData =
  | { kind: "doc"; page: DocPageData }
  | { kind: "landing"; landing: BranchLandingData };

interface ParsedRequest {
  documentLanguage: string;
  /** 逻辑路径 */
  path: string;
  legacy: boolean;
}

/** 解析文档语言（来自 URL 的 /docs-{language}/ 前缀） */
export function parseDocRequest(site: SiteData, request: DocPageRequest): ParsedRequest {
  const config = site.config;
  const documentLanguage =
    request.documentLanguage &&
    config.i18n.document_languages.some((lang) => lang.code === request.documentLanguage)
      ? request.documentLanguage
      : config.i18n.default_document_language;

  const segments = request.splat
    .split("/")
    .filter(Boolean)
    .map((segment) => safeDecode(segment));

  return {
    documentLanguage,
    path: normalizeSlashes(segments.join("/")),
    legacy: !request.documentLanguage,
  };
}

/**
 * 统一入口：先尝试命中具体文档；版本根且无索引页时退化为「版本首页」。
 */
export async function loadDocRoute(request: DocPageRequest): Promise<DocRouteData | null> {
  const site = await loadSiteData();
  const parsed = parseDocRequest(site, request);
  const page = await buildDocPage(site, request);
  if (page) return { kind: "doc", page };

  const branchData = site.branches.find((branch) => branch.name === request.branch);
  if (!branchData) return null;

  // 只有版本根（无 splat 或只写了语言段）才降级为版本首页，深路径继续 404
  if (parsed.path.trim() !== "") return null;

  const variant = getLanguageData(branchData, parsed.documentLanguage);

  return {
    kind: "landing",
    landing: {
      branch: branchData.name,
      branchLabel: branchData.label,
      documentLanguage: parsed.documentLanguage,
      documentLanguageLabel: languageLabel(parsed.documentLanguage, site.config.i18n),
      tree: variant.tree,
      docs: collectDocPaths(variant.tree),
    },
  };
}

export async function loadDocPage(request: DocPageRequest): Promise<DocPageData | null> {
  const site = await loadSiteData();
  return buildDocPage(site, request);
}

export async function buildDocPage(
  site: SiteData,
  request: DocPageRequest,
): Promise<DocPageData | null> {
  const branchData = site.branches.find((branch) => branch.name === request.branch);
  if (!branchData) return null;

  const { config } = site;
  const parsed = parseDocRequest(site, request);
  const variant = getLanguageData(branchData, parsed.documentLanguage);
  const requestedPath = parsed.path;

  // 1. 直接命中文件（其中可能省略扩展名）
  let docPath = resolveDocFile(variant.docs.keys(), requestedPath, config.document.supported_extensions);

  // 2. 命中目录索引页
  if (!docPath) {
    const dirPrefix = requestedPath ? `${requestedPath}/` : "";
    for (const indexPage of config.document.index_pages) {
      const candidate = `${dirPrefix}${indexPage}`;
      if (variant.docs.has(candidate)) {
        docPath = candidate;
        break;
      }
    }
  }

  if (!docPath) return null;
  const doc = variant.docs.get(docPath);
  if (!doc) return null;

  const kind = doc.kind;

  /** 目录是否存在可点击的索引页（面包屑据此决定是否可点） */
  const hasIndexFor = (dirPath: string): boolean => {
    const prefix = dirPath ? `${dirPath}/` : "";
    return config.document.index_pages.some((name) => variant.docs.has(`${prefix}${name}`));
  };

  // 外部挂载文档：构建期未缓存正文时按需拉取
  let raw = doc.raw;
  if (!raw && doc.externalUrl) {
    raw = await fetchExternalDoc(doc.externalUrl, site);
  }

  // 3. Markdown 渲染 / HTML 直出
  let html = "";
  let toc: TocHeading[] = [];
  if (kind === "markdown") {
    const rendered = await renderMarkdownInto(
      raw,
      docPath,
      request.branch,
      site,
      parsed.documentLanguage,
    );
    html = rendered.html;
    toc = rendered.toc;
  }

  // 4. 上一篇/下一篇
  const orderedDocs = collectDocPaths(variant.tree);
  const flat = orderedDocs.length > 0 ? orderedDocs : [...variant.docs.values()];
  const currentIndex = flat.findIndex((item) => item.path === docPath);

  const tocOptions: ExtractTocOptions = {
    tocNumbering: config.document.toc_numbering,
    tocIgnoreH1: config.document.toc_ignore_h1,
  };
  void tocOptions;

  const route = normalizeDocPath(docPath, config.document.index_pages, request.branch);
  const canonicalSegments = [
    `docs-${parsed.documentLanguage}`,
    route.branch,
    route.path,
  ].filter(Boolean);

  return {
    branch: request.branch,
    branchLabel: branchData.label,
    documentLanguage: parsed.documentLanguage,
    documentLanguageLabel: languageLabel(parsed.documentLanguage, config.i18n),
    language: parsed.documentLanguage,
    languageLabel: languageLabel(parsed.documentLanguage, config.i18n),
    fallbackLanguage:
      variant.fallback === true ||
      doc.fallback === true ||
      variant.language !== parsed.documentLanguage,
    docPath,
    sourcePath: doc.sourcePath || docPath,
    title: doc.title,
    kind,
    html,
    source: raw,
    git: findGitInfo(variant.tree, docPath),
    rawHtml: kind === "html" ? raw : undefined,
    externalUrl: doc.externalUrl,
    externalRepo: doc.externalRepo,
    toc,
    tree: variant.tree,
    prev: currentIndex > 0 ? flat[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null,
    breadcrumbs: buildBreadcrumbs(variant.tree, docPath, hasIndexFor),
    editUrl: doc.externalUrl
      ? undefined
      : buildEditUrl(site, request.branch, doc.sourcePath || docPath),
    canonicalPath: `/${canonicalSegments.join("/")}`,
  };
}

/** Async 包装，便于 loader 中使用 */
async function renderMarkdownInto(
  raw: string,
  docPath: string,
  branch: string,
  site: SiteData,
  documentLanguage: string,
): Promise<{ html: string; toc: TocHeading[] }> {
  const { config } = site;
  const result = await renderMarkdown(raw, {
    docPath,
    branch,
    defaultBranch: site.defaultBranch,
    documentLanguage,
    indexPages: config.document.index_pages,
    supportedExtensions: config.document.supported_extensions,
    baseUrl: config.site.base_url,
    codeBlock: {
      lineNumbers: config.document.code_block.line_numbers,
      startLine: config.document.code_block.start_line,
      theme: {
        light: config.document.code_block.theme.light ?? "github-light",
        dark: config.document.code_block.theme.dark ?? "github-dark",
      },
    },
    codeCopyButton: config.document.code_copy_button,
    math: config.extensions.math,
    highlight: config.extensions.highlight,
    mermaid: config.extensions.mermaid,
  }, getServerHighlighter());

  const toc = extractTocFromHtml(result.html, {
    tocNumbering: config.document.toc_numbering,
    tocIgnoreH1: config.document.toc_ignore_h1,
  });

  return { html: result.html, toc };
}

/** 请求路径 → 实际文件路径（补全扩展名） */
function resolveDocFile(
  keys: IterableIterator<string>,
  requestedPath: string,
  supportedExtensions: string[],
): string | null {
  const available = [...keys];
  if (!requestedPath) return null;
  if (available.includes(requestedPath)) return requestedPath;

  const lower = requestedPath.toLowerCase();
  for (const key of available) {
    if (key.toLowerCase() === lower) return key;
  }

  for (const ext of supportedExtensions) {
    const candidate = `${requestedPath}${ext}`;
    if (available.includes(candidate)) return candidate;
    const match = available.find((key) => key.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }
  return null;
}

/** 面包屑：版本根 → 各级目录 → 当前文档 */
function buildBreadcrumbs(
  tree: DocsNode,
  docPath: string,
  hasIndexFor: (dirPath: string) => boolean,
): Array<{ title: string; path: string; linkable?: boolean }> {
  const crumbs: Array<{ title: string; path: string; linkable?: boolean }> = [];

  const visit = (
    node: DocsNode,
    trail: Array<{ title: string; path: string; linkable?: boolean }>,
  ): boolean => {
    if (node.index?.path === docPath) {
      crumbs.push(...trail);
      return true;
    }
    for (const child of node.children) {
      const isFile = child.children.length === 0 && !child.index;
      if (isFile && child.path === docPath) {
        crumbs.push(...trail);
        return true;
      }
      if (!isFile) {
        const nextTrail = [
          ...trail,
          { title: child.title, path: child.path, linkable: hasIndexFor(child.path) },
        ];
        if (visit(child, nextTrail)) return true;
      }
    }
    return false;
  };

  visit(tree, []);
  return crumbs;
}

/** 在树中查找文档的 git 信息（构建期由 git log 注入） */
function findGitInfo(tree: DocsNode, docPath: string): GitInfo | undefined {
  let found: GitInfo | undefined;
  const visit = (node: DocsNode) => {
    if (found) return;
    if (node.index?.path === docPath) {
      found = node.index.git;
      return;
    }
    if (node.path === docPath && node.children.length === 0) {
      found = node.git;
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(tree);
  return found;
}

function buildEditUrl(site: SiteData, branch: string, sourcePath: string): string | undefined {
  const { config } = site;
  const github = config.extensions.github;
  if (!github.enable || !github.edit_link || !github.repo_url) return undefined;

  const match = github.repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?]+)/);
  if (!match) return undefined;
  const [, owner, repo] = match;
  const path = [site.pointer.rootDir, branch, sourcePath].filter(Boolean).join("/");
  return `https://github.com/${owner}/${repo}/edit/${site.pointer.branch}/${path}`;
}

/**
 * 拉取外部文档正文。
 * 构建期通常已经抓取；失败时降级为提示文本而不是让整站构建失败。
 */
async function fetchExternalDoc(url: string, site: SiteData): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: site.pointer.owner
        ? { Accept: "application/vnd.github.raw+json, text/plain, */*" }
        : undefined,
    });
    if (!response.ok) {
      return `> [WARNING] 外部文档读取失败\n>\n> 地址：${url}\n> 状态：${response.status}`;
    }
    return await response.text();
  } catch (error) {
    return `> [WARNING] 外部文档读取失败\n>\n> 地址：${url}\n> ${error instanceof Error ? error.message : String(error)}`;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export { stripExtension, docKind };
