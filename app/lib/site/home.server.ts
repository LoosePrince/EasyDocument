/**
 * 首页数据
 *
 * 除配置外还带上版本文档树，供首页的「文档入口 / 最新内容」区块使用。
 * 默认走配置驱动渲染；仅当 `home.use_file=true` 时读取 file_path 的 HTML 并消毒。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadSiteData } from "./load.server";
import { sanitizeHtml, extractBody } from "../html/sanitize";
import { collectDocPaths } from "../content/types";
import type { DocsNode } from "../content/types";

export interface HomeDocEntry {
  path: string;
  title: string;
  branch: string;
  branchLabel: string;
}

export interface HomeBranchEntry {
  name: string;
  label: string;
  docCount: number;
  tree: DocsNode;
}

export interface HomeContentData {
  config: Awaited<ReturnType<typeof loadSiteData>>["config"];
  defaultBranch: string;
  branches: HomeBranchEntry[];
  /** 默认版本的前 N 篇文档，用于「文档入口」区块 */
  featuredDocs: HomeDocEntry[];
  customHtml?: string;
}

const FEATURED_LIMIT = 8;

export async function loadHomeContent(): Promise<HomeContentData> {
  const site = await loadSiteData();
  const home = site.config.home;

  const branches: HomeBranchEntry[] = site.branches.map((branch) => ({
    name: branch.name,
    label: branch.label,
    docCount: branch.docs.size,
    tree: branch.tree,
  }));

  const defaultBranchData =
    site.branches.find((branch) => branch.name === site.defaultBranch) ?? site.branches[0];

  const featuredDocs: HomeDocEntry[] = defaultBranchData
    ? collectDocPaths(defaultBranchData.tree)
        .slice(0, FEATURED_LIMIT)
        .map((doc) => ({
          path: doc.path,
          title: doc.title,
          branch: defaultBranchData.name,
          branchLabel: defaultBranchData.label,
        }))
    : [];

  if (!home.use_file || !home.file_path) {
    return {
      config: site.config,
      defaultBranch: site.defaultBranch,
      branches,
      featuredDocs,
    };
  }

  try {
    const dataDir = process.env.EASYDOCUMENT_DATA_DIR || path.join(process.cwd(), ".data");
    const absolute = path.resolve(dataDir, home.file_path.replace(/^\/+/, ""));
    const raw = await readFile(absolute, "utf8");
    return {
      config: site.config,
      defaultBranch: site.defaultBranch,
      branches,
      featuredDocs,
      customHtml: sanitizeHtml(extractBody(raw)),
    };
  } catch {
    return { config: site.config, defaultBranch: site.defaultBranch, branches, featuredDocs };
  }
}
