/**
 * 文档树模型
 *
 * 与 legacy 的 `path.json` 保持结构兼容，但额外承载 v2.0.1 的能力：
 *  - 显示名与排序来自 path.json 配置（可被网页端编辑）
 *  - `hidden` 条目在侧栏隐藏（文件仍可通过直链访问）
 *  - 外部挂载节点带 `mount` 与 `externalUrl`
 */

export interface GitInfo {
  last_modified?: {
    timestamp: number;
    author: string;
    email?: string;
    message?: string;
    github_username?: string;
    github_avatar?: string;
  };
  contributors?: Array<{
    name: string;
    email?: string;
    commits: number;
    github_username?: string;
    github_avatar?: string;
    last_commit_timestamp?: number;
  }>;
}

export interface DocIndexNode {
  title: string;
  path: string;
  git?: GitInfo;
  /** 图标 id 或图标链接（path.json 配置，v2.0.2） */
  icon?: string;
  /** 实际文件路径（多语言后缀/文件夹与逻辑路径不同） */
  sourcePath?: string;
  /** 所属文档语言 */
  language?: string;
}

/** 外部文档挂载声明（来自 path.json） */
export interface ExternalMountInfo {
  mode: "path_json" | "github_tree";
  url: string;
}

export interface DocsNode {
  title: string;
  /** 分支内相对路径（POSIX，无前导斜杠）；目录为空时可能是 "" */
  path: string;
  children: DocsNode[];
  index?: DocIndexNode;
  git?: GitInfo;
  /** 在侧栏隐藏（仍可直链访问） */
  hidden?: boolean;
  /** 外部挂载节点（目录或文件） */
  mount?: ExternalMountInfo;
  /** 外部文档的原始内容地址（用于前端实时拉取与「在来源查看」） */
  externalUrl?: string;
  /** 外部文档所属仓库（用于显示来源信息） */
  externalRepo?: string;
  /** 图标 id 或图标链接（path.json 配置，v2.0.2） */
  icon?: string;
  /** 实际文件路径（多语言后缀/文件夹与逻辑路径不同） */
  sourcePath?: string;
  /** 所属文档语言 */
  language?: string;
  /** path.json 的多语言覆盖（原样保留，写回时使用） */
  translations?: Record<string, unknown>;
}

export type DocKind = "markdown" | "html";

export interface DocEntry {
  /** 分支内相对路径，例如 "使用指南/README.md" */
  path: string;
  title: string;
  kind: DocKind;
  /** 所属版本（data 分支下的目录名） */
  branch: string;
  git?: GitInfo;
  /** 外部文档原始地址 */
  externalUrl?: string;
  /** 文档语言（v2.0.2） */
  language?: string;
}

export function isIndexFileName(fileName: string, indexPages: string[]): boolean {
  const lower = fileName.toLowerCase();
  return indexPages.some((name) => name.toLowerCase() === lower);
}

export function stripExtension(path: string): string {
  return path.replace(/\.(md|markdown|html?)$/i, "");
}

export function fileExtension(path: string): string {
  const match = path.match(/(\.[^./]+)$/);
  return match ? match[1].toLowerCase() : "";
}

export function docKind(path: string): DocKind {
  return fileExtension(path) === ".md" || fileExtension(path) === ".markdown" ? "markdown" : "html";
}

function isFolderNode(node: DocsNode): boolean {
  return node.children.length > 0 || Boolean(node.index);
}

/** 扁平化文档树（深度优先，index 先于 children，与 legacy `getAllDocumentLinks` 一致） */
export function flattenDocs(node: DocsNode): DocEntry[] {
  const out: DocEntry[] = [];
  walk(node);
  return out;

  function walk(current: DocsNode) {
    if (current.index) {
      out.push({
        path: current.index.path,
        title: current.index.title,
        kind: docKind(current.index.path),
        branch: "",
        git: current.index.git,
      });
    }
    for (const child of current.children) {
      if (child.children.length === 0 && !child.index) {
        out.push({
          path: child.path,
          title: child.title,
          kind: docKind(child.path),
          branch: "",
          externalUrl: child.externalUrl,
        });
      } else {
        walk(child);
      }
    }
  }
}

/** 在树中按分支内路径查找节点（文件路径或目录路径均可） */
export function findNodeByPath(root: DocsNode, targetPath: string): DocsNode | null {
  const target = targetPath.replace(/^\/+/, "");
  let found: DocsNode | null = null;

  const visit = (node: DocsNode) => {
    if (found) return;
    if (node.path === target) {
      found = node;
      return;
    }
    if (node.index?.path === target) {
      found = node;
      return;
    }
    for (const child of node.children) visit(child);
  };

  visit(root);
  return found;
}

/** 收集树中所有可访问文档的路径（用于 SSG 枚举） */
export function collectDocPaths(root: DocsNode): Array<{ path: string; title: string }> {
  const out: Array<{ path: string; title: string }> = [];
  const visit = (node: DocsNode) => {
    if (node.index) out.push({ path: node.index.path, title: node.index.title });
    for (const child of node.children) {
      if (child.children.length === 0 && !child.index) {
        out.push({ path: child.path, title: child.title });
      } else {
        visit(child);
      }
    }
  };
  visit(root);
  return out;
}

/** 收集侧栏需要展示的节点（过滤 hidden） */
export function visibleTree(node: DocsNode): DocsNode {
  return {
    ...node,
    children: node.children.filter((child) => !child.hidden).map(visibleTree),
  };
}

export { isFolderNode };
