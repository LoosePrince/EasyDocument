/**
 * 目录配置（path.json）
 *
 * 与 legacy `build.py` 产出的 path.json 同构，但只用于「覆盖显示名 / 排序 / 隐藏 /
 * 外部挂载」，不再承担索引职责 —— 文档清单始终以内容分支里的真实文件为准。
 *
 * 支持两种写法，可混用：
 *
 * 1. 简写（推荐）
 *    {
 *      "title": "文档首页",
 *      "children": [
 *        { "path": "快速入门", "title": "快速开始" },
 *        { "path": "参考/README.md", "title": "参考手册" },
 *        { "path": "外部文档", "external": { "mode": "github_tree", "url": "…" } }
 *      ]
 *    }
 *
 * 2. 嵌套（legacy path.json 原样可用）
 *    { "title": "首页", "children": [ { "path": "指南", "children": [ … ] } ] }
 *
 * 读取位置（按优先级合并，后者覆盖前者）：
 *   - 内容根 `path.json`（可包含所有版本的嵌套结构）
 *   - 版本目录 `{version}/path.json`（只描述该版本）
 */
import type { DocsNode } from "./types";
import { stripExtension } from "./types";

/** 外部挂载声明 */
export interface ExternalMount {
  /** 挂载目录（相对版本根，如 "外部文档"） */
  path: string;
  mode: "path_json" | "github_tree";
  url: string;
  /** 目录显示名（path.json 里的 title） */
  title?: string;
}

export interface PathOverride {
  /** 显示名覆盖（目录或文件） */
  title?: string;
  /** 显式排序权重：数组顺序即顺序 */
  order: number;
  /** 隐藏该条目及其子项 */
  hidden?: boolean;
}

export interface PathConfig {
  /** 版本根标题（path.json 顶层 title） */
  rootTitle?: string;
  /** 归一化路径 → 覆盖项 */
  overrides: Map<string, PathOverride>;
  /** 外部挂载声明 */
  mounts: ExternalMount[];
}

export const EMPTY_PATH_CONFIG: PathConfig = {
  overrides: new Map(),
  mounts: [],
};

/**
 * 路径归一：去掉首尾斜杠与扩展名，便于用同一 key 匹配目录与文件。
 * `使用指南/README.md` 与 `使用指南/README` 与 `使用指南`（索引页）都能对上。
 */
export function normalizeConfigPath(input: string): string {
  let value = String(input ?? "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  // 去掉 "./" 前缀
  value = value.replace(/^(\.\/)+/, "");
  // 仅去掉文档扩展名，目录名里的点保留
  value = stripExtension(value);
  return value.replace(/\/+$/g, "");
}

interface RawNode {
  title?: unknown;
  path?: unknown;
  children?: unknown;
  index?: unknown;
  hidden?: unknown;
  external?: unknown;
}

interface RawExternal {
  mode?: unknown;
  url?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 解析一份 path.json。
 *
 * @param raw        JSON 内容
 * @param versionDir 当前版本名；只在 `{version}/path.json` 场景下传入，
 *                   用于把「版本根」与「内容根」区分开
 */
export function parsePathConfig(raw: unknown, versionDir?: string): PathConfig {
  const overrides = new Map<string, PathOverride>();
  const mounts: ExternalMount[] = [];
  let rootTitle: string | undefined;
  let order = 0;

  if (!isObject(raw)) return { overrides, mounts };

  const walk = (node: RawNode, isRoot: boolean) => {
    if (!isObject(node)) return;

    if (isRoot) {
      if (typeof node.title === "string" && node.title.trim()) rootTitle = node.title.trim();
      // 顶层若声明了 external（整版本挂载）也接受
      const mount = readMount(node, "");
      if (mount) mounts.push(mount);
    } else {
      const rawPath = typeof node.path === "string" ? node.path : "";
      const key = normalizeConfigPath(rawPath);
      if (key) {
        const override: PathOverride = { order: order++ };
        if (typeof node.title === "string" && node.title.trim()) {
          override.title = node.title.trim();
        }
        if (node.hidden === true) override.hidden = true;
        overrides.set(key, override);
        // 索引页显示名同样作用于目录节点
        const index = node.index;
        if (isObject(index) && typeof index.path === "string") {
          const indexKey = normalizeConfigPath(index.path);
          if (indexKey) overrides.set(indexKey, { ...override });
        }
      }

      // 挂载声明所在的目录若未单独给 title，也该按数组位置排序
      const mount = readMount(node, key);
      if (mount) {
        mounts.push(mount);
        if (key && !overrides.has(key)) {
          const override: PathOverride = { order: order++ };
          if (mount.title) override.title = mount.title;
          overrides.set(key, override);
        }
      }
    }

    const children = node.children;
    if (Array.isArray(children)) {
      for (const child of children) walk(child as RawNode, false);
    }
  };

  walk(raw as RawNode, !versionDir);
  return { rootTitle, overrides, mounts };
}

function readMount(node: RawNode, key: string): ExternalMount | null {
  if (!isObject(node.external)) return null;
  const external = node.external as RawExternal;
  const mode = external.mode;
  const url = external.url;
  if (mode !== "path_json" && mode !== "github_tree") return null;
  if (typeof url !== "string" || !url.trim()) return null;
  return {
    path: key,
    mode,
    url: url.trim(),
    title: typeof node.title === "string" ? node.title.trim() : undefined,
  };
}

/** 合并多份配置：后者覆盖前者的同名覆盖项，挂载按路径去重 */
export function mergePathConfigs(configs: PathConfig[]): PathConfig {
  const overrides = new Map<string, PathOverride>();
  const mountsByPath = new Map<string, ExternalMount>();
  let rootTitle: string | undefined;

  for (const config of configs) {
    if (config.rootTitle) rootTitle = config.rootTitle;
    for (const [key, value] of config.overrides) {
      const existing = overrides.get(key);
      // 保留先出现者的顺序，后出现者只覆盖显示名与隐藏
      overrides.set(key, existing ? { ...existing, ...value, order: existing.order } : value);
    }
    for (const mount of config.mounts) mountsByPath.set(mount.path, mount);
  }

  return { rootTitle, overrides, mounts: [...mountsByPath.values()] };
}

/** 把树序列化为可写回的 path.json（保留顺序与显示名） */
export function serializePathConfig(
  tree: DocsNode,
  options: { rootTitle?: string } = {},
): unknown {
  const children = tree.children
    .filter((node) => !node.hidden)
    .map((node) => {
      // 外部挂载节点即便还没有子项，也应写成目录并保留 external
      const isFile = node.children.length === 0 && !node.index && !node.mount;
      const entry: Record<string, unknown> = {
        path: isFile ? node.path : node.path || node.index?.path || "",
        title: node.title,
      };
      if (isFile) return entry;

      if (node.index) entry.index = { path: node.index.path, title: node.index.title };
      if (node.mount) {
        entry.external = { mode: node.mount.mode, url: node.mount.url };
      }
      const nested = serializePathConfig(node);
      const nestedChildren = (nested as { children?: unknown[] }).children;
      if (nestedChildren && nestedChildren.length > 0) entry.children = nestedChildren;
      return entry;
    });

  const output: Record<string, unknown> = { title: options.rootTitle ?? tree.title, children };
  return output;
}

/**
 * 前端重排辅助：把 `from` 节点移到 `to` 节点之前/之后，返回新的兄弟顺序。
 * 仅处理同一父级下的重排，跨级拖拽在 UI 层被拒绝。
 */
export function reorderSiblings<T extends { path: string }>(
  siblings: T[],
  fromPath: string,
  toPath: string,
  position: "before" | "after",
): T[] {
  if (fromPath === toPath) return siblings;
  const list = [...siblings];
  const fromIndex = list.findIndex((item) => item.path === fromPath);
  const toIndex = list.findIndex((item) => item.path === toPath);
  if (fromIndex === -1 || toIndex === -1) return siblings;

  const [moved] = list.splice(fromIndex, 1);
  const insertAt = list.findIndex((item) => item.path === toPath);
  if (insertAt === -1) return siblings;
  list.splice(position === "after" ? insertAt + 1 : insertAt, 0, moved);
  return list;
}
