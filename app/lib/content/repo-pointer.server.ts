/**
 * 指向 easydocument.json 的仓库指针文件内容（构建期读取）。
 *
 * 浏览器端无法读取 `easydocument.json`（Vite 不会把它打进产物），
 * 因此在构建时把指针与内容文件清单一起写进产物里的 `content-manifest.json`，
 * 运行期编辑台与客户端搜索都从该文件读取。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildContentPointer,
  DEFAULT_CONTENT_REF,
  type ContentPointer,
  type RepoPointerFile,
} from "./pointer";

export const MANIFEST_FILE = "content-manifest.json";

export async function loadRepoPointer(
  projectRoot = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ pointer: ContentPointer; file: RepoPointerFile }> {
  let file: RepoPointerFile = { data: DEFAULT_CONTENT_REF };
  try {
    const text = await readFile(path.join(projectRoot, "easydocument.json"), "utf8");
    file = JSON.parse(text) as RepoPointerFile;
  } catch {
    // 文件缺失时使用默认 `data:/config.js`
  }

  const pointer = buildContentPointer(file, {
    envRepo: env.EASYDOCUMENT_REPO || env.GITHUB_REPOSITORY,
    origin: env.EASYDOCUMENT_ORIGIN,
    githubRepoUrl: env.EASYDOCUMENT_REPO ? undefined : await readGitRemote(projectRoot),
  });

  return { pointer, file };
}

/**
 * 本地开发便利：从 `.git/config` 推断 origin（CI 里用 EASYDOCUMENT_REPO 即可）。
 * 只读取，不执行任何 git 命令。
 */
async function readGitRemote(projectRoot: string): Promise<string | undefined> {
  try {
    const config = await readFile(path.join(projectRoot, ".git", "config"), "utf8");
    const match = config.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}
