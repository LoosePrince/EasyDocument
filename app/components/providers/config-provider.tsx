import { createContext, useContext, useMemo } from "react";
import type { RootLoaderData } from "~/root";
import type { ResolvedConfig } from "~/lib/config/types";
import { siteHref } from "~/lib/content/routes";
import {
  collectDocPaths,
  findNodeByPath,
  stripExtension,
  type DocsNode,
} from "~/lib/content/types";

export interface SiteContextValue {
  config: ResolvedConfig;
  configWarnings: string[];
  defaultBranch: string;
  branches: RootLoaderData["branches"];
  pointer: RootLoaderData["pointer"];
  /** 把站内路径解析为当前可用的 href（含 base_url） */
  resolveHref: (path: string) => string;
  /** 该路由是否指向真实存在的文档（不存在时 UI 不应给出可点击入口） */
  hasRoute: (path: string) => boolean;
}

const ConfigContext = createContext<SiteContextValue | null>(null);

/**
 * 把 config 里写的站内路径归一成可用于校验的形式：
 *  - 站内绝对路径 /docs/...、/、/admin
 *  - 旧版写法 main/、main/#路径/（v1 兼容）
 */
function normalizeRoute(path: string): string {
  if (!path) return "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;

  let working = path.replace(/^\/+/, "").trim();
  // 去掉查询串
  const queryIndex = working.indexOf("?");
  if (queryIndex !== -1) working = working.slice(0, queryIndex);

  // v1: main/#路径/ 或 main/#/路径
  const hashMatch = working.match(/^([^/#]+)\/?#\/?(.*)$/);
  if (hashMatch) {
    const [, version, rest] = hashMatch;
    const tail = rest.replace(/\/+$/, "").replace(/\.(md|markdown|html?)$/i, "");
    return `/docs/${version}${tail ? `/${tail}` : ""}`;
  }

  working = working.replace(/\/+$/, "").replace(/\.(md|markdown|html?)$/i, "");
  if (working === "" || working === "docs") return "/docs";
  if (working.startsWith("docs/")) return `/${working}`;
  return `/${working}`;
}

export function ConfigProvider({
  value,
  children,
}: {
  value: RootLoaderData;
  children: React.ReactNode;
}) {
  const site = useMemo<SiteContextValue>(() => {
    // 预计算所有可访问路由（文档页 + 版本根），用于入口校验
    const routes = new Set<string>(["/", "/docs", "/admin", "/404"]);

    for (const branch of value.branches) {
      routes.add(`/docs/${encodeURIComponent(branch.name)}`);
      routes.add(`/docs/${branch.name}`);
      for (const doc of collectDocPaths(branch.tree)) {
        const base = doc.path.replace(/\.(md|markdown|html?)$/i, "");
        const parts = base.split("/").filter(Boolean);
        const last = parts[parts.length - 1] ?? "";
        const isIndex = value.config.document.index_pages.some(
          (name) => stripExtension(name).toLowerCase() === last.toLowerCase(),
        );
        if (isIndex) parts.pop();
        routes.add(`/docs/${branch.name}${parts.length ? `/${parts.join("/")}` : ""}`);
      }
    }

    const hasRoute = (path: string): boolean => {
      const normalized = normalizeRoute(path);
      if (normalized.startsWith("/docs/")) {
        // 允许 URL 编码形式
        if (routes.has(normalized)) return true;
        try {
          return routes.has(decodeURIComponent(normalized));
        } catch {
          return false;
        }
      }
      return routes.has(normalized);
    };

    return {
      ...value,
      resolveHref: (path: string) => siteHref(normalizeRoute(path), value.config.site.base_url),
      hasRoute,
    };
  }, [value]);

  return <ConfigContext.Provider value={site}>{children}</ConfigContext.Provider>;
}

export function useSite(): SiteContextValue {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("useSite 必须在 ConfigProvider 内使用");
  return value;
}

export function useConfig(): ResolvedConfig {
  return useSite().config;
}

/** 侧栏用：判断节点是否可点击（有索引页或本身是文件） */
export function isNavigableNode(node: DocsNode): boolean {
  if (node.children.length === 0 && !node.index) return true;
  return Boolean(node.index);
}

/** 侧栏用：找到某路径所属节点 */
export function locateNode(tree: DocsNode, path: string): DocsNode | null {
  return findNodeByPath(tree, path);
}
