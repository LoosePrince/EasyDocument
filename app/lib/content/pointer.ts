/**
 * 内容源解析
 *
 * 内容存放于仓库的指定 git 分支（默认 `data`），指针写在 main 分支的
 * `easydocument.json`：
 *
 *   { "data": "data:/config.js", "repo": "owner/repo" }   // repo 可选
 *
 * `data` 值形如 `{branch}:{path}`，表示「config.js 位于 branch 分支的 path 处」。
 * 文档根目录即该 config.js 所在目录。
 */

export const DEFAULT_CONTENT_REF = "data:/config.js";
/** 指针文件所在分支（本仓库代码分支） */
export const CODE_BRANCH = "main";

export interface ContentPointer {
  /** 内容所在 git 分支 */
  branch: string;
  /** config.js 在该分支中的路径（以 / 开头，无前导斜杠差异统一处理） */
  configPath: string;
  /** config.js 所在目录（即文档根），"" 表示分支根 */
  rootDir: string;
  owner: string;
  repo: string;
}

export interface RepoPointerFile {
  data?: string;
  repo?: string;
}

export function parseContentRef(
  value: string,
  repoSlug?: string,
): Omit<ContentPointer, "owner" | "repo"> & { repoSlug?: string } {
  const raw = (value || DEFAULT_CONTENT_REF).trim();
  const sep = raw.indexOf(":");
  // 允许省略分支（如 "/config.js" → 默认 data 分支）
  const branch = sep === -1 ? "data" : raw.slice(0, sep) || "data";
  const configPath = (sep === -1 ? raw : raw.slice(sep + 1)) || "/config.js";
  const normalized = normalizeSlashes(configPath);
  const rootDir = normalized.includes("/")
    ? normalized.slice(0, normalized.lastIndexOf("/"))
    : "";

  return { branch, configPath: normalized, rootDir, repoSlug };
}

export function normalizeSlashes(path: string): string {
  const trimmed = (path || "").trim().replace(/\\/g, "/");
  if (!trimmed || trimmed === "/") return "";
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * 解析仓库归属字符串。支持：
 *  - "owner/repo"（bare slug，CI 与 easydocument.json 常用）
 *  - "github.com/owner/repo"
 *  - "https://github.com/owner/repo(.git)"
 */
export function parseRepoSlug(input: string): { owner: string; repo: string } | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };
  }

  // bare "owner/repo"（不含协议、不含空格）
  const bareMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (bareMatch) {
    return { owner: bareMatch[1], repo: bareMatch[2] };
  }

  return null;
}

/**
 * 解析仓库归属。优先级：
 *  1. 显式环境变量 / 构建注入（SERVER_REPO）
 *  2. easydocument.json 的 `repo` 字段
 *  3. GitHub Pages 域名：<owner>.github.io/<repo>/
 *  4. config.extensions.github.repo_url
 */
export function resolveRepo(
  pointerRepo: string | undefined,
  opts: { envRepo?: string; origin?: string; githubRepoUrl?: string },
): { owner: string; repo: string } {
  const candidates = [opts.envRepo, pointerRepo, opts.githubRepoUrl];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = parseRepoSlug(candidate);
    if (parsed) return parsed;
  }

  // GitHub Pages 项目站点：https://<owner>.github.io/<repo>/
  const origin = opts.origin || "";
  const pagesMatch = origin.match(/^https?:\/\/([^.]+)\.github\.io(?::\d+)?\/([^/?#]+)/i);
  if (pagesMatch) {
    return { owner: pagesMatch[1], repo: pagesMatch[2] };
  }
  // 用户站点：https://<owner>.github.io/
  const userPages = origin.match(/^https?:\/\/([^.]+)\.github\.io(?::\d+)?\/?$/i);
  if (userPages) {
    return { owner: userPages[1], repo: `${userPages[1]}.github.io` };
  }

  return { owner: "", repo: "" };
}

export function buildContentPointer(
  file: RepoPointerFile,
  opts: { envRepo?: string; origin?: string; githubRepoUrl?: string },
): ContentPointer {
  const parsed = parseContentRef(file.data ?? DEFAULT_CONTENT_REF);
  const { owner, repo } = resolveRepo(file.repo, {
    ...opts,
    githubRepoUrl: opts.githubRepoUrl,
  });
  return {
    branch: parsed.branch,
    configPath: parsed.configPath,
    rootDir: parsed.rootDir,
    owner,
    repo,
  };
}

/** raw.githubusercontent.com 上的文件 URL（CORS 允许跨域） */
export function rawFileUrl(pointer: ContentPointer, path: string, branch = pointer.branch): string {
  const clean = normalizeSlashes(path);
  return `https://raw.githubusercontent.com/${pointer.owner}/${pointer.repo}/${branch}/${clean}`;
}

/** 拼接内容根下的相对路径，得到分支内路径 */
export function contentPath(pointer: ContentPointer, relativePath: string): string {
  return [pointer.rootDir, normalizeSlashes(relativePath)].filter(Boolean).join("/");
}
