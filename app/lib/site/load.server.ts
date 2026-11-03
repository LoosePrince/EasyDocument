/**
 * 构建期站点数据装配
 *
 * 一次构建产出（写入 public/，随站点发布）：
 *  - content-manifest.json  仓库指针 + 内容文件清单 + 版本列表
 *  - search-index.json      每个版本的搜索索引
 *
 * 同时给 SSG 提供「每个版本的文档树 + 每个文档的渲染结果」。
 *
 * v2.0.2：版本树按文档语言拆成多个变体（语言文件夹 / 文件二级后缀），
 * 并在构建期读取 git 历史与外部文档正文（用于搜索）。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateConfigModule } from "../config/evaluate";
import { resolveConfig, resolveConfigForLanguage } from "../config/schema";
import type { ResolvedConfig } from "../config/types";
import { loadRepoPointer } from "../content/repo-pointer.server";
import { LocalContentSource } from "../content/local-source";
import { RemoteContentSource } from "../content/remote-source";
import { contentPath, normalizeSlashes, type ContentPointer } from "../content/pointer";
import type { ContentSource } from "../content/source";
import { buildDocsTree, applyPathConfigToTree, extractTitle, type ScannedFile } from "../content/tree";
import type { DocsNode } from "../content/types";
import { docKind } from "../content/types";
import { buildSearchDoc, type SearchDoc, type SearchIndexFile } from "../search/index";
import { mergePathConfigs, parsePathConfig, type PathConfig } from "../content/path-config";
import { loadExternalMount, mergeMountIntoTree } from "../content/external";
import { fileExtension } from "../content/types";
import { detectDocumentLanguage } from "../content/language";
import { loadGitInfo } from "../content/git-info.server";

export interface DocEntryData {
  /** 逻辑路径（侧栏 / URL 使用） */
  path: string;
  /** 实际文件路径（相对版本目录；多语言后缀/文件夹与逻辑路径不同） */
  sourcePath: string;
  /** 文档语言 */
  language: string;
  title: string;
  kind: "markdown" | "html";
  raw: string;
  /** 外部文档：原始内容地址（不缓存正文） */
  externalUrl?: string;
  externalRepo?: string;
  /** 该语言没有译文，正文回落到默认语言 */
  fallback?: boolean;
}

/** 单个语言版本的树与文档 */
export interface LanguageData {
  language: string;
  tree: DocsNode;
  /** 逻辑路径 → 文档 */
  docs: Map<string, DocEntryData>;
  pathConfig: PathConfig;
  /** 该语言没有内容，回落到默认语言 */
  fallback?: boolean;
}

export interface BranchData extends LanguageData {
  name: string;
  label: string;
  /** 语言代码 → 变体（含默认语言与空语言回落） */
  variants: Map<string, LanguageData>;
  /** 配置里声明、可用于渲染的语言（顺序） */
  languages: string[];
}

export interface SiteData {
  config: ResolvedConfig;
  /** 站点语言 → 解析后的配置（含 locales 覆盖） */
  configs: Record<string, ResolvedConfig>;
  configWarnings: string[];
  pointer: ContentPointer;
  branches: BranchData[];
  defaultBranch: string;
  /** 内容工作区目录（本地构建时用于读取 git 信息） */
  dataDir?: string;
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
  const { source, dataDir } = await createSource(projectRoot, pointer, env, options.forceRemote);

  // 1. 读取并解析 config.js
  const configRaw = await source.readFile(
    pointer.rootDir ? stripPrefix(pointer.configPath, pointer.rootDir) : pointer.configPath,
  );
  const evaluated = evaluateConfigModule(configRaw, { label: pointer.configPath });
  const { config, warnings } = resolveConfig(evaluated);

  // 站点语言配置：locales[language] 覆盖基础配置（数组整体替换）
  const configs: Record<string, ResolvedConfig> = {};
  for (const lang of config.i18n.site_languages) {
    configs[lang.code] = resolveConfigForLanguage(evaluated, lang.code).config;
  }
  configs[config.i18n.default_language] = config;

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

  // 4. 构建期 git 信息（一次扫描全部文档）
  const contentPaths = docFiles
    .filter((file) => file.path.includes("/"))
    .map((file) => normalizeSlashes(file.path));
  const gitByPath = dataDir
    ? await loadGitInfo(dataDir, contentPaths, pointer.rootDir, {
        maxCommits: 400,
        timeoutMs: 20_000,
      })
    : {};

  // 5. 目录配置（path.json）按文档语言读取：根配置可包含所有语言/版本的覆盖
  const defaultDocLanguage = config.i18n.default_document_language;

  const branches: BranchData[] = [];

  for (const branch of branchList) {
    const prefix = `${branch.name}/`;
    const branchFiles = docFiles
      .filter((file) => file.path.startsWith(prefix))
      .map((file) => ({ ...file, path: file.path.slice(prefix.length) }));

    const branchDefaultPathConfig = mergePathConfigs([
      await readPathConfigAt(source, pointer, config, "", defaultDocLanguage),
      await readPathConfigAt(source, pointer, config, branch.name, defaultDocLanguage),
    ]);

    // 语言分组：逻辑路径 → 实际文件
    const grouped = groupFilesByLanguage(branchFiles, config);
    const variants = new Map<string, LanguageData>();

    for (const [language, entries] of grouped) {
      const languageDir = folderDirFor(config, language);
      const languagePathConfig =
        languageDir && language !== config.i18n.default_language
          ? await readPathConfigAt(
              source,
              pointer,
              config,
              [branch.name, languageDir].filter(Boolean).join("/"),
              language,
            )
          : null;

      const pathConfig = mergePathConfigs([
        await readPathConfigAt(source, pointer, config, "", language),
        await readPathConfigAt(source, pointer, config, branch.name, language),
        ...(languagePathConfig ? [languagePathConfig] : []),
      ]);

      const docs = new Map<string, DocEntryData>();
      const scanned: ScannedFile[] = [];

      for (const entry of entries) {
        const contentRelative = [branch.name, entry.sourcePath].filter(Boolean).join("/");
        const raw = await source.readFile(contentPath(pointer, contentRelative));
        const kind = docKind(entry.logicalPath);
        const fileName = entry.logicalPath.split("/").pop() ?? entry.logicalPath;
        const title = extractTitle(raw, fileName, kind);
        const git = gitByPath[contentRelative];
        docs.set(entry.logicalPath, {
          path: entry.logicalPath,
          sourcePath: entry.sourcePath,
          language,
          title,
          kind,
          raw,
        });
        scanned.push({
          path: entry.logicalPath,
          sourcePath: entry.sourcePath,
          language,
          title,
          git,
        });
      }

      const tree = buildDocsTree(scanned, {
        indexPages: config.document.index_pages,
        supportedExtensions: config.document.supported_extensions,
        rootTitle: "首页",
        pathConfig,
      });

      await attachExternalMounts({
        tree,
        docs,
        pathConfig,
        config,
        env,
        warnings,
      });

      variants.set(language, { language, tree, docs, pathConfig });
    }

    // 默认语言没有内容时，回落到第一个可用语言，避免版本首页为空
    if (!variants.has(config.i18n.default_language) && variants.size > 0) {
      const first = [...variants.values()][0];
      variants.set(config.i18n.default_language, { ...first, language: config.i18n.default_language });
    }
    if (!variants.has(config.i18n.default_language)) {
      variants.set(config.i18n.default_language, {
        language: config.i18n.default_language,
        tree: { title: "首页", path: "", children: [] },
        docs: new Map(),
        pathConfig: branchDefaultPathConfig,
      });
    }

    const defaultVariant = variants.get(config.i18n.default_language)!;

    // 部分翻译：未翻译的文档与目录回落到默认语言，保证侧栏与链接完整
    for (const [code, variant] of variants) {
      if (code === config.i18n.default_language || variant.fallback) continue;
      variants.set(code, mergeLanguageVariant(defaultVariant, variant));
    }

    // 配置里声明的语言即使没有内容，也生成回落变体，保证切换语言后 URL 可达
    if (config.i18n.enable && config.i18n.document_mode !== "off") {
      const fallback = variants.get(config.i18n.default_language)!;
      for (const lang of config.i18n.languages) {
        if (!variants.has(lang.code)) {
          variants.set(lang.code, {
            language: lang.code,
            tree: fallback.tree,
            docs: fallback.docs,
            pathConfig: fallback.pathConfig,
            fallback: true,
          });
        }
      }
    }

    const languageOrder =
      config.i18n.enable && config.i18n.document_mode !== "off"
        ? config.i18n.languages.map((lang) => lang.code).filter((code) => variants.has(code))
        : [config.i18n.default_language];

    branches.push({
      name: branch.name,
      label: branch.label ?? branch.name,
      ...defaultVariant,
      variants,
      languages: languageOrder,
    });
  }

  const siteData: SiteData = {
    config,
    configs,
    configWarnings: warnings,
    pointer,
    branches,
    defaultBranch,
    dataDir,
  };

  if (!options.forceRemote) cachedSiteData = siteData;
  return siteData;
}

interface LanguageFileEntry {
  logicalPath: string;
  sourcePath: string;
  marked: boolean;
}

/** 把版本内文件按语言分组；同一逻辑路径优先显式语言标记 */
function groupFilesByLanguage(
  branchFiles: Array<{ path: string }>,
  config: ResolvedConfig,
): Map<string, LanguageFileEntry[]> {
  const grouped = new Map<string, Map<string, LanguageFileEntry>>();

  for (const file of branchFiles) {
    const detected = detectDocumentLanguage(file.path, config.i18n);
    if (!detected.logicalPath) continue;
    let bucket = grouped.get(detected.language);
    if (!bucket) {
      bucket = new Map();
      grouped.set(detected.language, bucket);
    }
    const existing = bucket.get(detected.logicalPath);
    if (!existing || (!existing.marked && detected.marked)) {
      bucket.set(detected.logicalPath, {
        logicalPath: detected.logicalPath,
        sourcePath: file.path,
        marked: detected.marked,
      });
    }
  }

  const out = new Map<string, LanguageFileEntry[]>();
  for (const [language, bucket] of grouped) {
    out.set(language, [...bucket.values()]);
  }
  return out;
}

function folderDirFor(config: ResolvedConfig, language: string): string | undefined {
  if (!config.i18n.enable) return undefined;
  if (config.i18n.document_mode !== "folder" && config.i18n.document_mode !== "auto") {
    return undefined;
  }
  const lang = config.i18n.languages.find((item) => item.code === language);
  return lang?.dir || lang?.code;
}

/** 拉取并合并外部挂载；构建期同时抓取正文，供预渲染与搜索使用 */
async function attachExternalMounts(params: {
  tree: DocsNode;
  docs: Map<string, DocEntryData>;
  pathConfig: PathConfig;
  config: ResolvedConfig;
  env: NodeJS.ProcessEnv;
  warnings: string[];
}) {
  const { tree, docs, pathConfig, config, warnings, env } = params;
  if (pathConfig.mounts.length === 0) return;

  const token = env.GITHUB_TOKEN || env.EASYDOCATION_TOKEN || env.EASYDOCUMENT_TOKEN;
  const cache = externalMountCache;

  for (const mount of pathConfig.mounts) {
    const key = `${mount.mode}|${mount.url}|${mount.path}|${mount.title ?? ""}`;
    let promise = cache.get(key);
    if (!promise) {
      promise = loadExternalMount(mount, {
        indexPages: config.document.index_pages,
        supportedExtensions: config.document.supported_extensions,
        ...(token ? { token } : {}),
      });
      cache.set(key, promise);
    }
    const { result, warning } = await promise;
    if (warning) warnings.push(warning);
    if (!result) continue;

    mergeMountIntoTree(tree, result.node);

    // 构建期抓取正文：成功则参与搜索索引与预渲染
    const contents = await fetchExternalContents(result.resolvers, token);
    for (const [virtualPath, url] of result.resolvers) {
      if (docs.has(virtualPath)) continue;
      const virtualNode = findNode(tree, virtualPath);
      docs.set(virtualPath, {
        path: virtualPath,
        sourcePath: virtualPath,
        language: "",
        title: virtualNode?.title ?? findTitle(tree, virtualPath),
        kind: fileExtension(virtualPath) === ".md" || fileExtension(virtualPath) === ".markdown"
          ? "markdown"
          : "html",
        raw: contents.get(virtualPath) ?? "",
        externalUrl: url,
        externalRepo: result.repos.get(virtualPath)?.repoUrl,
      });
    }
    if (result.node.index?.path) {
      const indexDoc = docs.get(result.node.index.path);
      if (indexDoc) indexDoc.title = result.node.index.title;
    }
  }
}

const externalMountCache = new Map<
  string,
  Promise<Awaited<ReturnType<typeof loadExternalMount>>>
>();

/** 并发受控地抓取外部文档正文（失败保留空正文，不影响构建） */
async function fetchExternalContents(
  resolvers: Map<string, string>,
  token?: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const entries = [...resolvers.entries()];
  const limit = 6;

  for (let start = 0; start < entries.length; start += limit) {
    const slice = entries.slice(start, start + limit);
    await Promise.all(
      slice.map(async ([virtualPath, url]) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);
          try {
            const response = await fetch(url, {
              signal: controller.signal,
              headers: {
                Accept: "application/vnd.github.raw+json, text/plain, */*",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });
            if (response.ok) out.set(virtualPath, await response.text());
          } finally {
            clearTimeout(timer);
          }
        } catch {
          // 外部文档抓取失败：仅缺少正文，标题仍可搜索
        }
      }),
    );
  }
  return out;
}

function findNode(tree: DocsNode, target: string): DocsNode | null {
  let found: DocsNode | null = null;
  const visit = (node: DocsNode) => {
    if (found) return;
    if (node.path === target || node.index?.path === target) {
      found = node;
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(tree);
  return found;
}

async function createSource(
  projectRoot: string,
  pointer: ContentPointer,
  env: NodeJS.ProcessEnv,
  forceRemote?: boolean,
): Promise<{ source: ContentSource; dataDir?: string }> {
  if (!forceRemote) {
    const localDir = env.EASYDOCUMENT_DATA_DIR || path.join(projectRoot, ".data");
    try {
      const source = new LocalContentSource({ dataDir: localDir });
      await source.listFiles();
      return { source, dataDir: path.resolve(projectRoot, localDir) };
    } catch {
      // 本地副本不存在 → 回落到远程
    }
  }
  return { source: new RemoteContentSource({ pointer }) };
}

/** 读取并解析目录配置（缺失时返回空配置）；按文档语言应用 translations */
async function readPathConfigAt(
  source: ContentSource,
  pointer: ContentPointer,
  config: ResolvedConfig,
  relativeDir: string,
  language?: string,
): Promise<PathConfig> {
  const fileName = config.document.path_config || "path.json";
  const relative = [relativeDir, fileName].filter(Boolean).join("/");
  const target = contentPath(pointer, relative);
  try {
    const raw = await source.readFile(target);
    return parsePathConfig(
      JSON.parse(raw),
      relativeDir || undefined,
      language,
      config.i18n.default_document_language,
    );
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

/** 取某语言变体；不存在时回落到默认语言 */
export function getLanguageData(branch: BranchData, language?: string): LanguageData {
  if (language && branch.variants.has(language)) {
    return branch.variants.get(language)!;
  }
  return branch.variants.get(branch.language) ?? branch;
}

/**
 * 把「默认语言内容」合并进一个部分翻译的语言变体：
 * 已翻译的文档/目录覆盖默认内容，未翻译的保留默认内容并标记 fallback。
 */
function mergeLanguageVariant(base: LanguageData, translated: LanguageData): LanguageData {
  const docs = new Map<string, DocEntryData>();
  for (const [path, doc] of base.docs) {
    docs.set(path, { ...doc, fallback: true });
  }
  for (const [path, doc] of translated.docs) {
    docs.set(path, { ...doc, fallback: false });
  }

  return {
    language: translated.language,
    tree: (() => {
      const tree = mergeTree(base.tree, translated.tree);
      // 合并后再次应用该语言的 path.json，让未翻译条目的标题/图标也生效
      applyPathConfigToTree(tree, translated.pathConfig);
      return tree;
    })(),
    docs,
    pathConfig: translated.pathConfig,
  };
}

/** 以默认树为骨架，用译文树覆盖标题、图标与译文节点 */
function mergeTree(base: DocsNode, translated: DocsNode): DocsNode {
  const out = structuredClone(base);

  const apply = (target: DocsNode, source: DocsNode) => {
    if (source.index) {
      target.index = target.index ? { ...target.index, ...source.index } : { ...source.index };
      target.title = source.title;
    }
    if (source.icon) target.icon = source.icon;
    if (source.hidden !== undefined) target.hidden = source.hidden;
    if (source.mount) target.mount = source.mount;
    for (const child of source.children) {
      const existing = target.children.find((item) => item.path === child.path);
      if (existing) apply(existing, child);
      else target.children.push(structuredClone(child));
    }
  };

  apply(out, translated);
  return out;
}

/**
 * 取得某文档的渲染数据（按分支 + 文档语言 + 逻辑路径）
 */
export function getDocData(
  site: SiteData,
  branch: string,
  docPath: string,
  language?: string,
): { branch: BranchData; variant: LanguageData; doc: DocEntryData } | null {
  const branchData = site.branches.find((item) => item.name === branch);
  if (!branchData) return null;
  const variant = getLanguageData(branchData, language);
  const doc = variant.docs.get(normalizeSlashes(docPath));
  if (!doc) return null;
  return { branch: branchData, variant, doc };
}

/** 生成搜索索引文件（一个版本一份，包含全部语言） */
export function buildSearchIndexFile(branch: BranchData): SearchIndexFile {
  const docs: SearchDoc[] = [];
  const seen = new Set<string>();

  for (const [language, variant] of branch.variants) {
    if (variant.fallback) continue;
    for (const doc of variant.docs.values()) {
      if (doc.fallback) continue;
      const key = `${language}/${doc.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push(
        buildSearchDoc({
          branch: branch.name,
          path: doc.path,
          title: doc.title,
          content: doc.raw,
          kind: doc.kind,
          language: language === branch.language ? undefined : language,
        }),
      );
    }
  }

  return { version: 1, branch: branch.name, docs };
}

/** 生成内容清单（运行期编辑台/客户端搜索用） */
export function buildContentManifest(site: SiteData) {
  return {
    version: 2,
    pointer: {
      owner: site.pointer.owner,
      repo: site.pointer.repo,
      branch: site.pointer.branch,
      configPath: site.pointer.configPath,
      rootDir: site.pointer.rootDir,
    },
    defaultBranch: site.defaultBranch,
    languages: site.config.i18n.enable ? site.config.i18n.languages : [],
    branches: site.branches.map((branch) => ({
      name: branch.name,
      label: branch.label,
      docs: [...branch.docs.values()].map((doc) => ({
        path: doc.path,
        title: doc.title,
        kind: doc.kind,
        sourcePath: doc.sourcePath,
        language: doc.language,
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
