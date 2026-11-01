/**
 * 文档树模型
 *
 * 与 legacy 的 `path.json` 完全同构，便于：
 *  - 兼容已有的手工 path.json
 *  - 网页端编辑台复用同一结构
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
}

export interface DocsNode {
  title: string;
  /** 分支内相对路径（POSIX，无前导斜杠） */
  path: string;
  children: DocsNode[];
  index?: DocIndexNode;
  git?: GitInfo;
  /** 外部挂载来源（仅运行时） */
  external_source_url?: string;
  /** 外部 github_tree 挂载的元信息（仅运行时） */
  external_git_meta?: ExternalGitMeta;
}

export interface ExternalGitMeta {
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
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
  external?: ExternalGitMeta;
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
