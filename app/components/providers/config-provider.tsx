import { createContext, useContext, useMemo } from "react";
import type { RootLoaderData } from "~/root";
import type { ResolvedConfig } from "~/lib/config/types";
import { siteHref, upgradeLegacyPath } from "~/lib/content/routes";

export interface SiteContextValue {
  config: ResolvedConfig;
  configWarnings: string[];
  defaultBranch: string;
  branches: RootLoaderData["branches"];
  pointer: RootLoaderData["pointer"];
  /**
   * 把（可能来自旧版 config 的）站内路径解析为当前可用的 href。
   * 兼容 `main/`、`main/#路径/`、`/data/main/路径` 等 v1 写法。
   */
  resolveHref: (path: string) => string;
}

const ConfigContext = createContext<SiteContextValue | null>(null);

export function ConfigProvider({
  value,
  children,
}: {
  value: RootLoaderData;
  children: React.ReactNode;
}) {
  const site = useMemo<SiteContextValue>(() => {
    const versions = value.branches.map((branch) => branch.name);
    return {
      ...value,
      resolveHref: (path: string) =>
        siteHref(upgradeLegacyPath(path, versions), value.config.site.base_url),
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
