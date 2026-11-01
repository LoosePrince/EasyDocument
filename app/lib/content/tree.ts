/**
 * 文档树构建（等价 legacy `build.py` 的 scan_directory）
 *
 * 输入是一份「文件清单」（路径 + 可选标题覆盖 + 可选 git 信息），
 * 输出与 path.json 同构的 DocsNode。排序规则与 build.py 一致：
 *  - 同一目录内先文件、后子目录，各自按名称排序（localeCompare）
 *  - 若提供了 order 覆盖表，则按覆盖表顺序前置排列
 */
import type { DocsNode, DocIndexNode, GitInfo } from "./types";
import { isIndexFileName, stripExtension } from "./types";

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
}

export function buildDocsTree(files: ScannedFile[], options: BuildTreeOptions): DocsNode {
  const { indexPages, supportedExtensions, rootTitle = "首页", gitByPath = {} } = options;
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
      if (current === root && rootTitle === "首页") {
        root.title = "首页";
      }
    } else {
      const leaf: DocsNode = { title, path: cleanPath, children: [] };
      if (git) leaf.git = git;
      current.children.push(leaf);
    }
  }

  sortTree(root, files);
  return root;
}

function sortTree(node: DocsNode, files: ScannedFile[]) {
  const orderMap = new Map<string, number>();
  for (const file of files) {
    if (typeof file.order === "number") orderMap.set(file.path, file.order);
  }

  const compare = (a: { path: string; title: string }, b: { path: string; title: string }) => {
    const ao = orderMap.get(a.path);
    const bo = orderMap.get(b.path);
    if (ao !== undefined || bo !== undefined) {
      if (ao === undefined) return 1;
      if (bo === undefined) return -1;
      if (ao !== bo) return ao - bo;
    }
    return a.title.localeCompare(b.title, "zh-Hans-CN", { numeric: true });
  };

  const isFolder = (n: DocsNode) => n.children.length > 0 || Boolean(n.index);
  const filesOnly = node.children.filter((child) => !isFolder(child));
  const folders = node.children.filter(isFolder);

  filesOnly.sort(compare);
  folders.sort(compare);
  node.children = [...filesOnly, ...folders];

  for (const child of node.children) sortTree(child, files);
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
