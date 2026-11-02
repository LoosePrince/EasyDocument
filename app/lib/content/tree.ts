/**
 * 文档树构建（等价 legacy `build.py` 的 scan_directory）
 *
 * 输入是一份「文件清单」（路径 + 可选标题覆盖 + 可选 git 信息），
 * 输出与 path.json 同构的 DocsNode。
 *
 * 排序与显示名：
 *  - 优先使用 path.json 中的显式顺序（数组顺序即展示顺序）
 *  - 未在 path.json 中声明的条目排在后面，按「文件在前、目录在后」+ 名称排序
 *  - 显示名优先取 path.json 的 title，其次文档首个标题，最后文件名
 */
import type { DocsNode, DocIndexNode, GitInfo } from "./types";
import { isIndexFileName, stripExtension } from "./types";
import { normalizeConfigPath, type PathConfig } from "./path-config";

export interface ScannedFile {
  /** 分支内相对路径（POSIX） */
  path: string;
  /** 已提取的标题；缺省时用文件名 */
  title?: string;
  git?: GitInfo;
  /** 手工覆盖的排序权重（越小越靠前） */
  order?: number;
  /** 手工覆盖的标题（优先级最高） */
  titleOverride?: string;
}

export interface BuildTreeOptions {
  indexPages: string[];
  supportedExtensions: string[];
  /** 根节点标题，默认「首页」 */
  rootTitle?: string;
  /** git 信息表，key 为分支内相对路径 */
  gitByPath?: Record<string, GitInfo>;
  /** path.json 解析结果（显示名 / 排序 / 隐藏 / 外部挂载） */
  pathConfig?: PathConfig;
}

export function buildDocsTree(files: ScannedFile[], options: BuildTreeOptions): DocsNode {
  const {
    indexPages,
    supportedExtensions,
    rootTitle = "首页",
    gitByPath = {},
    pathConfig,
  } = options;
  const root: DocsNode = { title: rootTitle, path: "", children: [] };

  const supported = new Set(supportedExtensions.map((ext) => ext.toLowerCase()));

  for (const file of files) {
    const cleanPath = file.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanPath) continue;
    const fileName = cleanPath.split("/").pop() ?? cleanPath;
    const ext = fileName.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
    if (!supported.has(ext)) continue;

    const segments = cleanPath.split("/");
    const dirSegments = segments.slice(0, -1);
    const git = file.git ?? gitByPath[cleanPath];
    const title =
      file.titleOverride ?? file.title ?? stripExtension(fileName).replace(/_/g, " ");

    // 定位/创建目录节点
    let current = root;
    for (const segment of dirSegments) {
      let next = current.children.find(
        (child) => child.path === [...current.path.split("/").filter(Boolean), segment].join("/"),
      );
      if (!next) {
        next = {
          title: segment.replace(/_/g, " "),
          path: [...current.path.split("/").filter(Boolean), segment].join("/"),
          children: [],
        };
        current.children.push(next);
      }
      current = next;
    }

    if (isIndexFileName(fileName, indexPages)) {
      const index: DocIndexNode = { title, path: cleanPath };
      if (git) index.git = git;
      current.index = index;
      // 目录标题跟随索引页标题（legacy 行为）
      if (current !== root && dirSegments.length > 0) {
        current.title = title;
      }
    } else {
      const leaf: DocsNode = { title, path: cleanPath, children: [] };
      if (git) leaf.git = git;
      current.children.push(leaf);
    }
  }

  if (pathConfig) applyPathConfig(root, pathConfig);
  sortTree(root, files, pathConfig);

  // 未在目录配置里声明的挂载（路径尚不存在的目录）由调用方按需创建
  return root;
}

/** 把目录配置应用到已建好的树（浏览器端预览草稿时也用它） */
export function applyPathConfigToTree(root: DocsNode, config: PathConfig) {
  applyPathConfig(root, config);
  sortTree(root, [], config);
}

/**
 * 查目录配置中的覆盖项。
 *
 * path.json 里目录通常写目录路径（`使用指南`），但也可以写索引页路径
 * （`使用指南/README.md`）。两种 key 都要能命中。
 */
function findOverride(
  entry: { path: string; index?: DocIndexNode },
  config: PathConfig,
): import("./path-config").PathOverride | undefined {
  const keys = [entry.path, entry.index?.path]
    .filter((value): value is string => Boolean(value))
    .map(normalizeConfigPath)
    .filter(Boolean);
  for (const key of keys) {
    const hit = config.overrides.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/** 应用显示名 / 隐藏 / 外部挂载 */
function applyPathConfig(root: DocsNode, config: PathConfig) {
  const visit = (node: DocsNode) => {
    const override = findOverride(node, config);
    if (override) {
      if (override.title) {
        node.title = override.title;
        if (node.index) node.index.title = override.title;
      }
      if (override.hidden) node.hidden = true;
    }

    // 版本根标题
    if (node === root && config.rootTitle) root.title = config.rootTitle;

    for (const child of node.children) visit(child);
  };
  visit(root);

  for (const mount of config.mounts) {
    const node = ensureNode(root, mount.path);
    if (!node) continue;
    node.mount = { mode: mount.mode, url: mount.url };
    if (mount.title) node.title = mount.title;
  }
}

/** 按路径找到节点；不存在则按需创建目录节点 */
function ensureNode(root: DocsNode, targetPath: string): DocsNode | null {
  const segments = normalizeConfigPath(targetPath).split("/").filter(Boolean);
  if (segments.length === 0) return root;
  let current = root;
  for (const [index, segment] of segments.entries()) {
    const isLast = index === segments.length - 1;
    let next = current.children.find(
      (child) => normalizeConfigPath(child.path) === normalizeConfigPath(segment) &&
        child.path.split("/").length === current.path.split("/").filter(Boolean).length + 1,
    );
    if (!next) {
      next = {
        title: segment,
        path: [...current.path.split("/").filter(Boolean), segment].join("/"),
        children: [],
      };
      current.children.push(next);
    }
    if (isLast) return next;
    current = next;
  }
  return current;
}

function sortTree(node: DocsNode, files: ScannedFile[], pathConfig?: PathConfig) {
  const orderMap = new Map<string, number>();
  for (const file of files) {
    if (typeof file.order === "number") orderMap.set(file.path, file.order);
  }

  const orderOf = (entry: { path: string; index?: DocIndexNode }): number | undefined => {
    const explicit = orderMap.get(entry.path) ?? orderMap.get(entry.index?.path ?? "");
    if (typeof explicit === "number") return explicit;
    if (!pathConfig) return undefined;
    return findOverride(entry, pathConfig)?.order;
  };

  const compare = (
    a: { path: string; title: string; index?: DocIndexNode },
    b: { path: string; title: string; index?: DocIndexNode },
  ) => {
    const ao = orderOf(a);
    const bo = orderOf(b);
    if (ao !== undefined || bo !== undefined) {
      if (ao === undefined) return 1;
      if (bo === undefined) return -1;
      if (ao !== bo) return ao - bo;
    }
    return a.title.localeCompare(b.title, "zh-Hans-CN", { numeric: true });
  };

  // 外部挂载节点此时可能还没有子项，但它语义上是目录
  const isFolder = (n: DocsNode) => n.children.length > 0 || Boolean(n.index) || Boolean(n.mount);
  const filesOnly = node.children.filter((child) => !isFolder(child));
  const folders = node.children.filter(isFolder);

  filesOnly.sort(compare);
  folders.sort(compare);
  node.children = [...filesOnly, ...folders];

  for (const child of node.children) sortTree(child, files, pathConfig);
}

/** 从文档内容中提取标题（等价 build.py get_file_title） */
export function extractTitle(content: string, fileName: string, kind: "markdown" | "html"): string {
  if (kind === "markdown") {
    const heading = content.match(/^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/m);
    if (heading) return heading[1].trim();
  } else {
    const titleTag = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTag) return decodeEntities(titleTag[1]).trim();
    const h1 = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) return decodeEntities(stripTags(h1[1])).trim();
  }
  return stripExtension(fileName).replace(/_/g, " ");
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
