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
  /** 图标 id 或图标链接（v2.0.2） */
  icon?: string;
  /** 原始 translations 对象，写回 path.json 时原样保留 */
  translations?: Record<string, unknown>;
}

export interface PathConfig {
  /** 版本根标题（path.json 顶层 title） */
  rootTitle?: string;
  /** 版本根标题的多语言覆盖（原样保留） */
  rootTranslations?: Record<string, unknown>;
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
  icon?: unknown;
  /** 多语言覆盖：{ en: { title, icon, hidden, index: { title, icon } } } */
  translations?: unknown;
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
 * @param raw             JSON 内容
 * @param versionDir      当前版本名；只在 `{version}/path.json` 场景下传入
 * @param language        当前文档语言（应用 `translations[language]`）
 * @param defaultLanguage 默认文档语言（默认语言的字段直接使用基础值）
 */
export function parsePathConfig(
  raw: unknown,
  versionDir?: string,
  language?: string,
  defaultLanguage?: string,
): PathConfig {
  const overrides = new Map<string, PathOverride>();
  const mounts: ExternalMount[] = [];
  let rootTitle: string | undefined;
  let rootTranslations: Record<string, unknown> | undefined;
  let order = 0;
  const useTranslation = Boolean(language && defaultLanguage && language !== defaultLanguage);

  if (!isObject(raw)) return { overrides, mounts };

  const walk = (node: RawNode, isRoot: boolean) => {
    if (!isObject(node)) return;
    const localized = useTranslation ? readTranslation(node.translations, language!) : null;

    if (isRoot) {
      const rootTitleValue =
        localized?.title ?? (typeof node.title === "string" ? node.title.trim() : "");
      if (rootTitleValue) rootTitle = rootTitleValue;
      if (isObject(node.translations)) {
        rootTranslations = node.translations as Record<string, unknown>;
      }
      // 顶层若声明了 external（整版本挂载）也接受
      const mount = readMount(node, "", localized?.title);
      if (mount) mounts.push(mount);
    } else {
      const rawPath = typeof node.path === "string" ? node.path : "";
      const key = normalizeConfigPath(rawPath);
      if (key) {
        const override: PathOverride = { order: order++ };
        const title =
          localized?.title ?? (typeof node.title === "string" ? node.title.trim() : "");
        if (title) override.title = title;
        const icon = localized?.icon ?? (typeof node.icon === "string" ? node.icon.trim() : "");
        if (icon) override.icon = icon;
        const hidden = localized?.hidden ?? node.hidden;
        if (hidden === true) override.hidden = true;
        if (isObject(node.translations)) {
          override.translations = node.translations as Record<string, unknown>;
        }
        overrides.set(key, override);
        // 索引页显示名同样作用于目录节点
        const index = node.index;
        if (isObject(index) && typeof index.path === "string") {
          const indexKey = normalizeConfigPath(index.path);
          if (indexKey) {
            const indexOverride: PathOverride = { ...override };
            const indexTitle =
              localized?.index?.title ??
              (typeof (index as RawNode).title === "string"
                ? ((index as RawNode).title as string).trim()
                : "");
            if (indexTitle) indexOverride.title = indexTitle;
            const indexIcon =
              localized?.index?.icon ??
              (typeof (index as RawNode).icon === "string"
                ? ((index as RawNode).icon as string).trim()
                : "");
            if (indexIcon) indexOverride.icon = indexIcon;
            overrides.set(indexKey, indexOverride);
          }
        }
      }

      // 挂载声明所在的目录若未单独给 title，也该按数组位置排序
      const mount = readMount(node, key, localized?.title);
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
  return { rootTitle, rootTranslations, overrides, mounts };
}

interface LocalizedNode {
  title?: string;
  icon?: string;
  hidden?: boolean;
  index?: { title?: string; icon?: string };
}

function readTranslation(translations: unknown, language: string): LocalizedNode | null {
  if (!isObject(translations)) return null;
  const entry = translations[language];
  if (!isObject(entry)) return null;
  const index = isObject(entry.index) ? entry.index : null;
  return {
    title: typeof entry.title === "string" ? entry.title.trim() : undefined,
    icon: typeof entry.icon === "string" ? entry.icon.trim() : undefined,
    hidden: typeof entry.hidden === "boolean" ? entry.hidden : undefined,
    index: index
      ? {
          title: typeof index.title === "string" ? index.title.trim() : undefined,
          icon: typeof index.icon === "string" ? index.icon.trim() : undefined,
        }
      : undefined,
  };
}

function readMount(node: RawNode, key: string, titleOverride?: string): ExternalMount | null {
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
    title:
      titleOverride?.trim() ||
      (typeof node.title === "string" ? node.title.trim() : undefined),
  };
}

/** 合并多份配置：后者覆盖前者的同名覆盖项，挂载按路径去重 */
export function mergePathConfigs(configs: PathConfig[]): PathConfig {
  const overrides = new Map<string, PathOverride>();
  const mountsByPath = new Map<string, ExternalMount>();
  let rootTitle: string | undefined;
  let rootTranslations: Record<string, unknown> | undefined;

  for (const config of configs) {
    if (config.rootTitle) rootTitle = config.rootTitle;
    if (config.rootTranslations) rootTranslations = config.rootTranslations;
    for (const [key, value] of config.overrides) {
      const existing = overrides.get(key);
      // 保留先出现者的顺序，后出现者只覆盖显示名与隐藏
      overrides.set(key, existing ? { ...existing, ...value, order: existing.order } : value);
    }
    for (const mount of config.mounts) mountsByPath.set(mount.path, mount);
  }

  return { rootTitle, rootTranslations, overrides, mounts: [...mountsByPath.values()] };
}

/** 把树序列化为可写回的 path.json（保留顺序、显示名、图标与多语言） */
export function serializePathConfig(
  tree: DocsNode,
  options: {
    rootTitle?: string;
    /** 以该文档语言写入 translations，而不是覆盖基础 title/icon */
    localizeLanguage?: string;
    defaultLanguage?: string;
  } = {},
): unknown {
  const localize =
    Boolean(options.localizeLanguage && options.defaultLanguage) &&
    options.localizeLanguage !== options.defaultLanguage;
  const language = options.localizeLanguage ?? "";

  const children = tree.children
    .filter((node) => !node.hidden)
    .map((node) => {
      const isFile = node.children.length === 0 && !node.index && !node.mount;
      const entry: Record<string, unknown> = {
        path: isFile ? node.path : node.path || node.index?.path || "",
      };

      if (localize) {
        const translations =
          node.translations && typeof node.translations === "object"
            ? { ...(node.translations as Record<string, unknown>) }
            : {};
        const existing =
          translations[language] && typeof translations[language] === "object"
            ? (translations[language] as Record<string, unknown>)
            : {};
        translations[language] = {
          ...existing,
          title: node.title,
          ...(node.icon ? { icon: node.icon } : {}),
        };
        entry.translations = translations;
      } else {
        entry.title = node.title;
        if (node.icon) entry.icon = node.icon;
        if (node.translations) entry.translations = node.translations;
      }

      if (isFile) return entry;

      if (node.index) {
        entry.index = localize
          ? { path: node.index.path }
          : {
              path: node.index.path,
              title: node.index.title,
              ...(node.index.icon ? { icon: node.index.icon } : {}),
            };
      }
      if (node.mount) {
        entry.external = { mode: node.mount.mode, url: node.mount.url };
      }
      const nested = serializePathConfig(node, options);
      const nestedChildren = (nested as { children?: unknown[] }).children;
      if (nestedChildren && nestedChildren.length > 0) entry.children = nestedChildren;
      return entry;
    });

  const output: Record<string, unknown> = {};
  if (localize) {
    output.translations = {
      [language]: { title: options.rootTitle ?? tree.title },
    };
  } else {
    output.title = options.rootTitle ?? tree.title;
    if (tree.translations) output.translations = tree.translations;
  }
  output.children = children;
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
