/**
 * 外部文档挂载
 *
 * 取代 v2.0.0 的 `document.external_docs`：挂载声明写在目录配置（path.json）里，
 * 与目录树天然对齐，并且同时支持两种数据来源：
 *
 *  - `path_json`   ：一个 path.json（或包含 path.json 的公开目录），
 *                    用 GitHub 链接或任意公开 URL 均可
 *  - `github_tree` ：GitHub 目录链接 `https://github.com/{o}/{r}/tree/{branch}/{dir}`，
 *                    无 token 时走 Contents API（有速率限制），有 token 时自动带上
 *
 * 构建期（Node）与前端（浏览器）共用本模块：只用 `fetch`，不依赖 Node API，
 * 因此同一套解析逻辑既能拉取也能在网页端实时刷新。
 */
import type { DocsNode } from "./types";
import { stripExtension } from "./types";

export interface ExternalFetchOptions {
  /** 可选 PAT：仅用于提高 GitHub API 速率上限 / 访问私有仓库 */
  token?: string;
  /** 自定义 fetch（测试注入） */
  fetchImpl?: typeof fetch;
  /** 超时（毫秒） */
  timeoutMs?: number;
}

export interface LoadedMount {
  /** 挂载节点（path 为挂载目录路径，children 为外部文档） */
  node: DocsNode;
  /** 虚拟路径 → 原始内容 URL */
  resolvers: Map<string, string>;
  /** 虚拟路径 → 仓库信息（github_tree 场景） */
  repos: Map<string, { repoUrl: string; filePath: string }>;
  /** 展示用来源描述 */
  source: string;
  /** 挂载自身的 path.json 原文（前端可据此再刷新） */
  warning?: string;
}

interface GithubLocation {
  owner: string;
  repo: string;
  branch: string;
  dirPath: string;
}

/** 解析 GitHub 目录链接；非 GitHub 链接返回 null */
export function parseGithubTreeUrl(input: string): GithubLocation | null {
  try {
    const url = new URL(input.trim());
    if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 3 || parts[2] !== "tree") return null;
    const [owner, repo, , branch, ...rest] = parts;
    if (!owner || !repo || !branch) return null;
    let dirPath = rest.join("/");
    try {
      dirPath = decodeURIComponent(dirPath);
    } catch {
      // 保留原样
    }
    return { owner, repo, branch, dirPath };
  } catch {
    return null;
  }
}

/** 由任意 URL 推断 GitHub 原始内容地址（无 API 调用） */
export function githubRawUrl(location: GithubLocation, filePath: string): string {
  const clean = filePath.replace(/^\/+/, "");
  return `https://raw.githubusercontent.com/${location.owner}/${location.repo}/${location.branch}/${clean}`;
}

function joinUrl(base: string, relative: string): string {
  const normalizedBase = base.replace(/\/+$/, "") + "/";
  return new URL(relative.replace(/^\/+/, ""), normalizedBase).toString();
}

function dirOf(url: string): string {
  const clean = url.split("#")[0].split("?")[0];
  return clean.slice(0, clean.lastIndexOf("/"));
}

async function smartFetch(url: string, options: ExternalFetchOptions): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json, application/json, text/plain, */*",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** 在 GitHub Contents API 中递归列目录（深度优先，文件在前目录在后） */
async function listGithubTree(
  location: GithubLocation,
  options: ExternalFetchOptions,
): Promise<{ dirs: Array<{ name: string; path: string }>; files: Array<{ name: string; path: string }> }> {
  // contents 路径按原样拼（CJK 交给 fetch 自己编码），只对分支做转义
  const url = `https://api.github.com/repos/${location.owner}/${location.repo}/contents/${location.dirPath}?ref=${encodeURIComponent(location.branch)}`;
  const response = await smartFetch(url, options);
  if (!response.ok) {
    throw new Error(`GitHub Contents API 错误 ${response.status}`);
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("GitHub Contents 返回的不是目录列表");
  }
  const entries = data as Array<{ name: string; path: string; type: string }>;
  return {
    dirs: entries.filter((item) => item.type === "dir").map((item) => ({ name: item.name, path: item.path })),
    files: entries.filter((item) => item.type === "file").map((item) => ({ name: item.name, path: item.path })),
  };
}

/** 构造接受 path.json `children` 数组的解析器 */
function buildNodeFromPathJson(
  raw: unknown,
  mountPath: string,
  options: {
    title?: string;
    indexPages: string[];
    supportedExtensions: string[];
    resolveUrl: (originalPath: string) => string;
    repoOf?: (originalPath: string) => string | undefined;
  },
): LoadedMount {
  const resolvers = new Map<string, string>();
  const repos = new Map<string, { repoUrl: string; filePath: string }>();
  const rootTitle = options.title || mountPath;

  const normalize = (value: string) =>
    String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");

  const virtualPath = (relative: string) => {
    const clean = normalize(relative);
    return [mountPath, clean].filter(Boolean).join("/");
  };

  const isSupported = (path: string) => {
    const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
    if (!ext) return false;
    return options.supportedExtensions.some((item) => item.toLowerCase() === ext);
  };

  const isIndex = (path: string) => {
    const name = path.split("/").pop() ?? "";
    return options.indexPages.some((item) => item.toLowerCase() === name.toLowerCase());
  };

  const walk = (node: unknown, depth: number): DocsNode[] => {
    if (!node || typeof node !== "object") return [];
    const record = node as {
      title?: unknown;
      path?: unknown;
      index?: unknown;
      children?: unknown;
    };

    const rawPath = typeof record.path === "string" ? normalize(record.path) : "";
    const childList = Array.isArray(record.children) ? record.children : [];
    const indexRecord =
      record.index && typeof record.index === "object"
        ? (record.index as { title?: unknown; path?: unknown })
        : null;

    const directoryLike = childList.length > 0 || Boolean(indexRecord);
    if (directoryLike && rawPath && depth > 0) {
      // 目录节点
      const nodePath = virtualPath(rawPath);
      const children: DocsNode[] = [];

      if (indexRecord && typeof indexRecord.path === "string") {
        const originalIndex = normalize(indexRecord.path);
        if (isSupported(originalIndex)) {
          const virtualIndex = virtualPath(originalIndex);
          resolvers.set(virtualIndex, options.resolveUrl(originalIndex));
          const repoUrl = options.repoOf?.(originalIndex);
          if (repoUrl) repos.set(virtualIndex, { repoUrl, filePath: originalIndex });
          children.push({
            title:
              typeof indexRecord.title === "string" && indexRecord.title.trim()
                ? indexRecord.title.trim()
                : titleFromPath(virtualIndex),
            path: virtualIndex,
            children: [],
            externalUrl: options.resolveUrl(originalIndex),
            externalRepo: repoUrl,
          });
        }
      }

      for (const child of childList) {
        const childRecord = child as { path?: unknown; children?: unknown; index?: unknown };
        const childPath = typeof childRecord.path === "string" ? normalize(childRecord.path) : "";
        const childIsDir =
          (Array.isArray(childRecord.children) && childRecord.children.length > 0) ||
          Boolean(childRecord.index);
        if (childIsDir) {
          children.push(...walk(child, depth + 1));
          continue;
        }
        if (!childPath) continue;
        const virtual = virtualPath(childPath);
        if (!isSupported(childPath)) continue;
        if (isIndex(childPath)) continue;
        resolvers.set(virtual, options.resolveUrl(childPath));
        const repoUrl = options.repoOf?.(childPath);
        if (repoUrl) repos.set(virtual, { repoUrl, filePath: childPath });
        children.push({
          title:
            typeof (child as { title?: unknown }).title === "string" &&
            ((child as { title?: string }).title ?? "").trim()
              ? String((child as { title?: string }).title).trim()
              : titleFromPath(virtual),
          path: virtual,
          children: [],
          externalUrl: options.resolveUrl(childPath),
          externalRepo: repoUrl,
        });
      }

      // 目录自身的索引页：作为目录节点（可导航）
      const indexChild = children.find((item) => isIndex(item.path));
      const rest = children.filter((item) => item !== indexChild);

      return [
        {
          title:
            typeof record.title === "string" && record.title.trim()
              ? record.title.trim()
              : titleFromPath(nodePath),
          path: nodePath,
          children: rest,
          ...(indexChild
            ? { index: { title: indexChild.title, path: indexChild.path } }
            : {}),
        },
      ];
    }

    if (depth === 0) {
      // 顶层节点：其 children 是挂载内容
      return childList.flatMap((child) => walk(child, depth + 1));
    }

    // 文件节点
    if (!rawPath || !isSupported(rawPath)) return [];
    const virtual = virtualPath(rawPath);
    resolvers.set(virtual, options.resolveUrl(rawPath));
    return [
      {
        title:
          typeof record.title === "string" && record.title.trim()
            ? record.title.trim()
            : titleFromPath(virtual),
        path: virtual,
        children: [],
        externalUrl: options.resolveUrl(rawPath),
      },
    ];
  };

  const rootRaw = raw as { children?: unknown; title?: unknown } | null;
  const children = Array.isArray(rootRaw?.children)
    ? rootRaw.children.flatMap((child) => walk(child, 1))
    : [];

  return {
    node: {
      title: rootTitle,
      path: mountPath,
      children,
    },
    resolvers,
    repos,
    source: options.resolveUrl(""),
  };
}

function titleFromPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  return stripExtension(name).replace(/_/g, " ");
}

/**
 * 加载一个挂载声明，返回可合并进版本树的节点。
 *
 * 失败时返回 null 并给出 warning，避免一个坏链接拖垮整站构建。
 */
export async function loadExternalMount(
  mount: { mode: "path_json" | "github_tree"; url: string; path: string; title?: string },
  options: { indexPages: string[]; supportedExtensions: string[] } & ExternalFetchOptions,
): Promise<{ result: LoadedMount | null; warning?: string }> {
  const mountPath = mount.path.replace(/^\/+|\/+$/g, "");
  try {
    if (mount.mode === "github_tree") {
      return await loadGithubTreeMount(mount, mountPath, options);
    }
    return await loadPathJsonMount(mount, mountPath, options);
  } catch (error) {
    return {
      result: null,
      warning: `外部挂载「${mountPath || mount.url}」加载失败：${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

async function loadPathJsonMount(
  mount: { url: string; title?: string },
  mountPath: string,
  options: { indexPages: string[]; supportedExtensions: string[] } & ExternalFetchOptions,
): Promise<{ result: LoadedMount | null; warning?: string }> {
  let pathJsonUrl = mount.url;

  // 传入的是目录 → 尝试补 path.json
  if (!/\.json($|[?#])/i.test(mount.url)) {
    pathJsonUrl = joinUrl(mount.url, "path.json");
  }

  const response = await smartFetch(pathJsonUrl, options);
  if (!response.ok) {
    return { result: null, warning: `外部 path.json 读取失败（${response.status}）：${pathJsonUrl}` };
  }

  const raw = (await response.json()) as unknown;
  const base = dirOf(pathJsonUrl);

  const result = buildNodeFromPathJson(raw, mountPath, {
    title: mount.title,
    indexPages: options.indexPages,
    supportedExtensions: options.supportedExtensions,
    resolveUrl: (originalPath) => (originalPath ? joinUrl(base, originalPath) : pathJsonUrl),
  });
  result.source = pathJsonUrl;
  return { result };
}

async function loadGithubTreeMount(
  mount: { url: string; title?: string },
  mountPath: string,
  options: { indexPages: string[]; supportedExtensions: string[] } & ExternalFetchOptions,
): Promise<{ result: LoadedMount | null; warning?: string }> {
  const location = parseGithubTreeUrl(mount.url);
  if (!location) {
    return { result: null, warning: `不是有效的 GitHub 目录链接：${mount.url}` };
  }

  const repoUrl = `https://github.com/${location.owner}/${location.repo}`;

  // 根目录有 path.json 时优先使用（与 legacy 一致）
  const rootList = await listGithubTree(location, options);
  const pathJsonFile = rootList.files.find((file) => file.name.toLowerCase() === "path.json");
  if (pathJsonFile) {
    const pathJsonUrl = githubRawUrl(location, pathJsonFile.path);
    const loaded = await loadPathJsonMount(
      { url: pathJsonUrl, title: mount.title },
      mountPath,
      {
        ...options,
        fetchImpl: options.fetchImpl,
      },
    );
    if (loaded.result) {
      // 记录仓库信息，便于前端显示来源
      for (const [virtual, url] of loaded.result.resolvers) {
        const original = url.slice(githubRawUrl(location, "").length);
        loaded.result.repos.set(virtual, { repoUrl, filePath: original });
      }
      return loaded;
    }
  }

  const isSupported = (path: string) => {
    const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
    return options.supportedExtensions.some((item) => item.toLowerCase() === ext);
  };
  const isIndex = (path: string) => {
    const name = path.split("/").pop() ?? "";
    return options.indexPages.some((item) => item.toLowerCase() === name.toLowerCase());
  };

  const resolvers = new Map<string, string>();
  const repos = new Map<string, { repoUrl: string; filePath: string }>();

  const walkDir = async (dir: GithubLocation, virtualBase: string): Promise<DocsNode[]> => {
    const listing = await listGithubTree(dir, options);
    const dirs = [...listing.dirs].sort((a, b) => a.name.localeCompare(b.name));
    const files = [...listing.files].sort((a, b) => a.name.localeCompare(b.name));

    const nodes: DocsNode[] = [];
    const indexFile = files.find((file) => isIndex(file.name));

    // 索引页也要有节点（挂载节点的 index / 子目录的 index 都取自它）
    for (const file of files) {
      if (!isSupported(file.name)) continue;
      const virtual = [virtualBase, file.name].filter(Boolean).join("/");
      const rawUrl = githubRawUrl(dir, file.path);
      resolvers.set(virtual, rawUrl);
      repos.set(virtual, { repoUrl, filePath: file.path });
      nodes.push({
        title: titleFromPath(file.name),
        path: virtual,
        children: [],
        externalUrl: rawUrl,
        externalRepo: repoUrl,
      });
    }
    void indexFile;

    for (const sub of dirs) {
      const virtual = [virtualBase, sub.name].filter(Boolean).join("/");
      const subLocation: GithubLocation = { ...dir, dirPath: sub.path };
      const children = await walkDir(subLocation, virtual);
      const indexNode = children.find((item) => isIndex(item.path));
      const rest = children.filter((item) => item !== indexNode);
      if (rest.length === 0 && !indexNode) continue;

      nodes.push({
        title: sub.name.replace(/_/g, " "),
        path: virtual,
        children: rest,
        ...(indexNode ? { index: { title: indexNode.title, path: indexNode.path } } : {}),
      });
    }

    return nodes;
  };

  // 根目录直接挂在挂载路径下（`外部/README.md`）
  const rootChildren = await walkDir(location, mountPath);

  // 根目录索引页作为挂载节点自身的索引
  const rootIndex = rootChildren.find((item) => isIndex(item.path));
  const rest = rootChildren.filter((item) => item !== rootIndex);

  const node: DocsNode = {
    title: mount.title || location.dirPath.split("/").pop() || mountPath,
    path: mountPath,
    children: rest,
    ...(rootIndex ? { index: { title: rootIndex.title, path: rootIndex.path } } : {}),
  };

  return {
    result: {
      node,
      resolvers,
      repos,
      source: mount.url,
    },
  };
}

/** 把挂载结果合并进版本树（同路径目录合并子项，不覆盖本地内容） */
export function mergeMountIntoTree(tree: DocsNode, mounted: DocsNode): void {
  const target = findOrCreate(tree, mounted.path);
  if (!target) return;
  target.mount = { mode: "path_json", url: "" };

  if (!target.index && mounted.index) target.index = mounted.index;
  if (!target.title || target.title === mounted.path.split("/").pop()) {
    target.title = mounted.title;
  }

  const mergeChildren = (dst: DocsNode, src: DocsNode) => {
    for (const child of src.children) {
      const same = dst.children.find((item) => item.path === child.path);
      if (!same) {
        dst.children.push(child);
        continue;
      }
      if ((same.children.length > 0 || same.index) && (child.children.length > 0 || child.index)) {
        if (!same.index && child.index) same.index = child.index;
        mergeChildren(same, child);
      }
    }
  };
  mergeChildren(target, mounted);
}

function findOrCreate(root: DocsNode, targetPath: string): DocsNode | null {
  const segments = targetPath.split("/").filter(Boolean);
  if (segments.length === 0) return root;
  let current = root;
  for (const [index, segment] of segments.entries()) {
    let next = current.children.find((child) => child.path === [...current.path.split("/").filter(Boolean), segment].join("/"));
    if (!next) {
      next = {
        title: segment,
        path: [...current.path.split("/").filter(Boolean), segment].join("/"),
        children: [],
      };
      current.children.push(next);
    }
    if (index === segments.length - 1) return next;
    current = next;
  }
  return current;
}

/** 从挂载结果里取出「虚拟路径 → 原始 URL」映射（含索引页） */
export function collectExternalResolvers(mounted: LoadedMount): Map<string, string> {
  const map = new Map(mounted.resolvers);
  if (mounted.node.index?.path) {
    const indexChild = mounted.node.children.find((item) => item.path === mounted.node.index?.path);
    void indexChild;
  }
  return map;
}
