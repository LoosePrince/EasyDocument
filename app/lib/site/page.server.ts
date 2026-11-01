/**
 * 文档页数据装配（构建期执行，结果写入 `.data`）
 */
import { loadSiteData, type SiteData } from "../site/load.server";
import { normalizeSlashes } from "../content/pointer";
import { docKind, stripExtension, type DocsNode } from "../content/types";
import { collectDocPaths } from "../content/types";
import { normalizeDocPath } from "../content/routes";
import { renderMarkdown } from "../markdown/render";
import { extractTocFromHtml, type ExtractTocOptions } from "../markdown/toc";
import type { TocHeading } from "~/components/toc/table-of-contents";

export interface DocPageData {
  branch: string;
  branchLabel: string;
  /** 分支内真实文件路径，如 "使用指南/README.md" */
  docPath: string;
  title: string;
  kind: "markdown" | "html";
  /** Markdown 渲染结果；HTML 文档为空（走 iframe） */
  html: string;
  /** HTML 文档的原始内容（放入 iframe srcdoc） */
  rawHtml?: string;
  toc: TocHeading[];
  tree: DocsNode;
  prev: { path: string; title: string } | null;
  next: { path: string; title: string } | null;
  /** 面包屑（从版本根到当前目录） */
  breadcrumbs: Array<{ title: string; path: string }>;
  editUrl?: string;
  canonicalPath: string;
}

export interface DocPageRequest {
  branch: string;
  /** URL 中的路径段（未解码） */
  splat: string;
}

export interface BranchLandingData {
  branch: string;
  branchLabel: string;
  tree: DocsNode;
  docs: Array<{ path: string; title: string }>;
}

export type DocRouteData =
  | { kind: "doc"; page: DocPageData }
  | { kind: "landing"; landing: BranchLandingData };

/**
 * 统一入口：先尝试命中具体文档；版本根且无索引页时退化为「版本首页」。
 */
export async function loadDocRoute(request: DocPageRequest): Promise<DocRouteData | null> {
  const site = await loadSiteData();
  const page = await buildDocPage(site, request);
  if (page) return { kind: "doc", page };

  const branchData = site.branches.find((branch) => branch.name === request.branch);
  if (!branchData) return null;

  // 只有版本根（无 splat）才降级为版本首页，深路径继续 404
  if (request.splat.trim() !== "") return null;

  return {
    kind: "landing",
    landing: {
      branch: branchData.name,
      branchLabel: branchData.label,
      tree: branchData.tree,
      docs: collectDocPaths(branchData.tree),
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
  const segments = request.splat
    .split("/")
    .filter(Boolean)
    .map((segment) => safeDecode(segment));
  const requestedPath = normalizeSlashes(segments.join("/"));

  // 1. 直接命中文件（其中可能省略扩展名）
  let docPath = resolveDocFile(branchData.docs.keys(), requestedPath, config.document.supported_extensions);

  // 2. 命中目录索引页
  if (!docPath) {
    const dirPrefix = requestedPath ? `${requestedPath}/` : "";
    for (const indexPage of config.document.index_pages) {
      const candidate = `${dirPrefix}${indexPage}`;
      if (branchData.docs.has(candidate)) {
        docPath = candidate;
        break;
      }
    }
  }

  if (!docPath) return null;
  const doc = branchData.docs.get(docPath);
  if (!doc) return null;

  const kind = doc.kind;

  // 3. Markdown 渲染 / HTML 直出
  let html = "";
  let toc: TocHeading[] = [];
  if (kind === "markdown") {
    const rendered = await renderMarkdownInto(doc.raw, docPath, request.branch, site);
    html = rendered.html;
    toc = rendered.toc;
  }

  // 4. 上一篇/下一篇
  const orderedDocs = collectDocPaths(branchData.tree);
  const flat = orderedDocs.length > 0 ? orderedDocs : [...branchData.docs.values()];
  const currentIndex = flat.findIndex((item) => item.path === docPath);

  const tocOptions: ExtractTocOptions = {
    tocNumbering: config.document.toc_numbering,
    tocIgnoreH1: config.document.toc_ignore_h1,
  };
  void tocOptions;

  const route = normalizeDocPath(docPath, config.document.index_pages, request.branch);
  const canonicalSegments = ["docs", route.branch, route.path].filter(Boolean);

  return {
    branch: request.branch,
    branchLabel: branchData.label,
    docPath,
    title: doc.title,
    kind,
    html,
    rawHtml: kind === "html" ? doc.raw : undefined,
    toc,
    tree: branchData.tree,
    prev: currentIndex > 0 ? flat[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null,
    breadcrumbs: buildBreadcrumbs(branchData.tree, docPath),
    editUrl: buildEditUrl(site, request.branch, docPath),
    canonicalPath: `/${canonicalSegments.join("/")}`,
  };
}

/** Async 包装，便于 loader 中使用 */
async function renderMarkdownInto(
  raw: string,
  docPath: string,
  branch: string,
  site: SiteData,
): Promise<{ html: string; toc: TocHeading[] }> {
  const { config } = site;
  const result = await renderMarkdown(raw, {
    docPath,
    branch,
    defaultBranch: site.defaultBranch,
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
  });

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
function buildBreadcrumbs(tree: DocsNode, docPath: string): Array<{ title: string; path: string }> {
  const crumbs: Array<{ title: string; path: string }> = [];

  const visit = (node: DocsNode, trail: Array<{ title: string; path: string }>): boolean => {
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
        const nextTrail = [...trail, { title: child.title, path: child.path }];
        if (visit(child, nextTrail)) return true;
      }
    }
    return false;
  };

  visit(tree, []);
  return crumbs;
}

function buildEditUrl(site: SiteData, branch: string, docPath: string): string | undefined {
  const { config } = site;
  const github = config.extensions.github;
  if (!github.enable || !github.edit_link || !github.repo_url) return undefined;

  const match = github.repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?]+)/);
  if (!match) return undefined;
  const [, owner, repo] = match;
  const path = [site.pointer.rootDir, branch, docPath].filter(Boolean).join("/");
  return `https://github.com/${owner}/${repo}/edit/${site.pointer.branch}/${path}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export { stripExtension, docKind };
