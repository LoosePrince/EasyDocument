/**
 * 构建期站点数据装配
 *
 * 一次构建产出（写入 public/，随站点发布）：
 *  - content-manifest.json  仓库指针 + 内容文件清单 + 版本列表
 *  - search-index.json      每个版本的搜索索引
 *
 * 同时给 SSG 提供「每个版本的文档树 + 每个文档的渲染结果」。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateConfigModule } from "../config/evaluate";
import { resolveConfig } from "../config/schema";
import type { ResolvedConfig } from "../config/types";
import { loadRepoPointer } from "../content/repo-pointer.server";
import { LocalContentSource } from "../content/local-source";
import { RemoteContentSource } from "../content/remote-source";
import { contentPath, normalizeSlashes, type ContentPointer } from "../content/pointer";
import type { ContentSource } from "../content/source";
import { buildDocsTree, extractTitle, type ScannedFile } from "../content/tree";
import type { DocsNode } from "../content/types";
import { docKind } from "../content/types";
import { buildSearchDoc, type SearchDoc, type SearchIndexFile } from "../search/index";
import { mergePathConfigs, parsePathConfig, type PathConfig } from "../content/path-config";
import { loadExternalMount, mergeMountIntoTree } from "../content/external";
import { fileExtension } from "../content/types";

export interface BranchData {
  name: string;
  label: string;
  tree: DocsNode;
  /** 分支内路径 → 文档条目 */
  docs: Map<string, DocEntryData>;
  /** 目录配置（path.json）；无则为空配置 */
  pathConfig: PathConfig;
}

export interface DocEntryData {
  path: string;
  title: string;
  kind: "markdown" | "html";
  raw: string;
  /** 外部文档：原始内容地址（不缓存正文） */
  externalUrl?: string;
  externalRepo?: string;
}

export interface SiteData {
  config: ResolvedConfig;
  configWarnings: string[];
  pointer: ContentPointer;
  branches: BranchData[];
  defaultBranch: string;
}

export interface LoadOptions {
  projectRoot?: string;
  /** 强制使用远程源（用于本地无 .data/ 时） */
  forceRemote?: boolean;
  env?: NodeJS.ProcessEnv;
}

let cachedSiteData: SiteData | null = null;

export async function loadSiteData(options: LoadOptions = {}): Promise<SiteData> {
  if (cachedSiteData && !options.forceRemote) return cachedSiteData;

  const projectRoot = options.projectRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const { pointer } = await loadRepoPointer(projectRoot, env);
  const source = await createSource(projectRoot, pointer, env, options.forceRemote);

  // 1. 读取并解析 config.js
  const configRaw = await source.readFile(
    pointer.rootDir ? stripPrefix(pointer.configPath, pointer.rootDir) : pointer.configPath,
  );
  const evaluated = evaluateConfigModule(configRaw, { label: pointer.configPath });
  const { config, warnings } = resolveConfig(evaluated);

  // 2. 列出全部内容文件
  const files = await source.listFiles();
  const supported = new Set(config.document.supported_extensions.map((ext) => ext.toLowerCase()));
  const docFiles = files.filter((file) => {
    const ext = file.path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
    return supported.has(ext);
  });

  // 3. 版本列表 = 内容根下的一级目录
  const branchNames = new Set<string>();
  for (const file of docFiles) {
    const first = file.path.split("/")[0];
    if (!first) continue;
    // 根目录下的文件属于默认版本
    if (!file.path.includes("/")) continue;
    branchNames.add(first);
  }
  if (branchNames.size === 0) branchNames.add(config.document.default_branch);

  // config.available_branches 决定展示顺序与标签，缺失的目录自动隐藏
  const configured = config.document.available_branches.filter((branch) =>
    branchNames.has(branch.name),
  );
  const extra = [...branchNames]
    .filter((name) => !configured.some((branch) => branch.name === name))
    .sort()
    .map((name) => ({ name, label: name }));
  const branchList = [...configured, ...extra];

  const defaultBranch = branchList.some((b) => b.name === config.document.default_branch)
    ? config.document.default_branch
    : (branchList[0]?.name ?? config.document.default_branch);

  // 4. 逐版本构建树 + 读取文档
  const branches: BranchData[] = [];

  // 内容根的目录配置（可包含所有版本的嵌套结构）
  const rootPathConfig = await readPathConfig(source, pointer, config, "");

  for (const branch of branchList) {
    const prefix = `${branch.name}/`;
    const branchFiles = docFiles
      .filter((file) => file.path.startsWith(prefix))
      .map((file) => ({ ...file, path: file.path.slice(prefix.length) }));

    // 版本目录下的目录配置（只描述该版本），覆盖根配置
    const branchPathConfig = await readPathConfig(source, pointer, config, branch.name);
    const pathConfig = mergePathConfigs([rootPathConfig, branchPathConfig]);

    const docs = new Map<string, DocEntryData>();
    const scanned: ScannedFile[] = [];

    for (const file of branchFiles) {
      const raw = await source.readFile(contentPath({ ...pointer, rootDir: pointer.rootDir }, `${branch.name}/${file.path}`));
      const kind = docKind(file.path);
      const fileName = file.path.split("/").pop() ?? file.path;
      const title = extractTitle(raw, fileName, kind);
      docs.set(file.path, { path: file.path, title, kind, raw });
      scanned.push({ path: file.path, title });
    }

    const tree = buildDocsTree(scanned, {
      indexPages: config.document.index_pages,
      supportedExtensions: config.document.supported_extensions,
      rootTitle: "首页",
      pathConfig,
    });

    // 外部挂载：构建期拉取一次，结果与本地内容一起预渲染
    for (const mount of pathConfig.mounts) {
      const { result, warning } = await loadExternalMount(mount, {
        indexPages: config.document.index_pages,
        supportedExtensions: config.document.supported_extensions,
      });
      if (warning) warnings.push(warning);
      if (!result) continue;

      mergeMountIntoTree(tree, result.node);
      for (const [virtualPath, url] of result.resolvers) {
        if (docs.has(virtualPath)) continue;
        docs.set(virtualPath, {
          path: virtualPath,
          title: findTitle(tree, virtualPath),
          kind: fileExtension(virtualPath) === ".md" ? "markdown" : "html",
          raw: "",
          externalUrl: url,
          externalRepo: result.repos.get(virtualPath)?.repoUrl,
        });
        // 外部索引页同样要能访问
        if (result.node.index?.path === virtualPath) {
          docs.get(virtualPath)!.title = result.node.index.title;
        }
      }
    }

    branches.push({
      name: branch.name,
      label: branch.label ?? branch.name,
      tree,
      docs,
      pathConfig,
    });
  }

  const siteData: SiteData = {
    config,
    configWarnings: warnings,
    pointer,
    branches,
    defaultBranch,
  };

  if (!options.forceRemote) cachedSiteData = siteData;
  return siteData;
}

async function createSource(
  projectRoot: string,
  pointer: ContentPointer,
  env: NodeJS.ProcessEnv,
  forceRemote?: boolean,
): Promise<ContentSource> {
  if (!forceRemote) {
    const localDir = env.EASYDOCUMENT_DATA_DIR || path.join(projectRoot, ".data");
    try {
      const source = new LocalContentSource({ dataDir: localDir });
      await source.listFiles();
      return source;
    } catch {
      // 本地副本不存在 → 回落到远程
    }
  }
  return new RemoteContentSource({ pointer });
}

/** 读取并解析目录配置（缺失时返回空配置） */
async function readPathConfig(
  source: ContentSource,
  pointer: ContentPointer,
  config: ResolvedConfig,
  branchDir: string,
): Promise<PathConfig> {
  const fileName = config.document.path_config || "path.json";
  const relative = [branchDir, fileName].filter(Boolean).join("/");
  const target = contentPath({ ...pointer, rootDir: pointer.rootDir }, relative);
  try {
    const raw = await source.readFile(target);
    return parsePathConfig(JSON.parse(raw), branchDir || undefined);
  } catch {
    return { overrides: new Map(), mounts: [] };
  }
}

/** 在树中找某路径的显示名 */
function findTitle(tree: DocsNode, target: string): string {
  let found: string | undefined;
  const visit = (node: DocsNode) => {
    if (found !== undefined) return;
    if (node.index?.path === target) {
      found = node.index.title;
      return;
    }
    if (node.path === target) {
      found = node.title;
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(tree);
  return found ?? (target.split("/").pop() ?? target);
}

function stripPrefix(filePath: string, prefix: string): string {
  const clean = `${normalizeSlashes(prefix)}/`;
  return filePath.startsWith(clean) ? filePath.slice(clean.length) : filePath;
}

/**
 * 取得某文档的渲染数据（按分支 + 分支内路径）
 */
export function getDocData(
  site: SiteData,
  branch: string,
  docPath: string,
): { branch: BranchData; doc: DocEntryData } | null {
  const branchData = site.branches.find((item) => item.name === branch);
  if (!branchData) return null;
  const doc = branchData.docs.get(normalizeSlashes(docPath));
  if (!doc) return null;
  return { branch: branchData, doc };
}

/** 生成搜索索引文件（每个版本一份） */
export function buildSearchIndexFile(branch: BranchData): SearchIndexFile {
  const docs: SearchDoc[] = [...branch.docs.values()].map((doc) =>
    buildSearchDoc({
      branch: branch.name,
      path: doc.path,
      title: doc.title,
      content: doc.raw,
      kind: doc.kind,
    }),
  );
  return { version: 1, branch: branch.name, docs };
}

/** 生成内容清单（运行期编辑台/客户端搜索用） */
export function buildContentManifest(site: SiteData) {
  return {
    version: 1,
    pointer: {
      owner: site.pointer.owner,
      repo: site.pointer.repo,
      branch: site.pointer.branch,
      configPath: site.pointer.configPath,
      rootDir: site.pointer.rootDir,
    },
    defaultBranch: site.defaultBranch,
    branches: site.branches.map((branch) => ({
      name: branch.name,
      label: branch.label,
      docs: [...branch.docs.values()].map((doc) => ({
        path: doc.path,
        title: doc.title,
        kind: doc.kind,
      })),
    })),
  };
}

export type ContentManifest = ReturnType<typeof buildContentManifest>;

/** 把构建产物写入 public/ 目录，供运行期读取 */
export async function writeBuildArtifacts(site: SiteData, projectRoot = process.cwd()) {
  const publicDir = path.join(projectRoot, "public");
  await mkdir(publicDir, { recursive: true });

  const manifest = buildContentManifest(site);
  await writeFile(
    path.join(publicDir, "content-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  for (const branch of site.branches) {
    const index = buildSearchIndexFile(branch);
    await writeFile(
      path.join(publicDir, `search-index.${branch.name}.json`),
      JSON.stringify(index),
      "utf8",
    );
  }

  return { manifest };
}
