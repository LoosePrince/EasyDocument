/**
 * 运行期/无本地副本时的内容源：GitHub 远程。
 *
 * 文件列表来源优先级：
 *  1. jsDelivr data API（无需鉴权、CORS 开放）
 *  2. GitHub Trees API（带 token 时可用；无 token 有速率限制）
 *  3. git-tree.json（构建期生成并随站点发布的静态清单）
 */
import { ContentSourceError, type ContentFileInfo, type ContentSource } from "./source";
import { contentPath, normalizeSlashes, type ContentPointer } from "./pointer";

export interface RemoteSourceOptions {
  pointer: ContentPointer;
  /** 可选 PAT，用于提高速率上限或访问私有仓库 */
  token?: string;
  /** 可选静态清单 URL（构建产物中的 git-tree.json） */
  manifestUrl?: string;
}

export class RemoteContentSource implements ContentSource {
  private readonly pointer: ContentPointer;
  private readonly token?: string;
  private readonly manifestUrl?: string;
  private fileCache = new Map<string, string>();

  constructor(options: RemoteSourceOptions) {
    this.pointer = options.pointer;
    this.token = options.token;
    this.manifestUrl = options.manifestUrl;
  }

  describe() {
    return `github:${this.pointer.owner}/${this.pointer.repo}@${this.pointer.branch}${this.pointer.rootDir ? `/${this.pointer.rootDir}` : ""}`;
  }

  async listFiles(): Promise<ContentFileInfo[]> {
    if (this.manifestUrl) {
      const fromManifest = await this.tryManifest();
      if (fromManifest) return fromManifest;
    }
    const fromJsdelivr = await this.tryJsdelivr();
    if (fromJsdelivr) return fromJsdelivr;
    return this.fromGitHubTree();
  }

  async readFile(filePath: string): Promise<string> {
    const clean = normalizeSlashes(filePath);
    const cached = this.fileCache.get(clean);
    if (cached !== undefined) return cached;

    const url = this.rawUrl(contentPath(this.pointer, clean));
    const response = await fetch(url, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
    });
    if (!response.ok) {
      throw new ContentSourceError(
        `读取文件失败 (${response.status}): ${filePath}`,
        this.describe(),
      );
    }
    const text = await response.text();
    this.fileCache.set(clean, text);
    return text;
  }

  private rawUrl(branchPath: string): string {
    return `https://raw.githubusercontent.com/${this.pointer.owner}/${this.pointer.repo}/${this.pointer.branch}/${normalizeSlashes(branchPath)}`;
  }

  private async tryManifest(): Promise<ContentFileInfo[] | null> {
    if (!this.manifestUrl) return null;
    try {
      const response = await fetch(this.manifestUrl);
      if (!response.ok) return null;
      const data = (await response.json()) as { files?: ContentFileInfo[] };
      if (!Array.isArray(data.files)) return null;
      return this.scopeToRoot(data.files);
    } catch {
      return null;
    }
  }

  private async tryJsdelivr(): Promise<ContentFileInfo[] | null> {
    const url = `https://data.jsdelivr.com/v1/packages/gh/${this.pointer.owner}/${this.pointer.repo}@${this.pointer.branch}?structure=flat`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = (await response.json()) as { files?: Array<{ name: string; size: number }> };
      if (!Array.isArray(data.files)) return null;
      const files = data.files
        .map((file) => ({ path: normalizeSlashes(file.name), size: file.size }))
        .filter((file) => !file.path.startsWith(".git/"));
      return this.scopeToRoot(files);
    } catch {
      return null;
    }
  }

  private async fromGitHubTree(): Promise<ContentFileInfo[]> {
    if (!this.pointer.owner || !this.pointer.repo) {
      throw new ContentSourceError(
        "无法确定仓库归属，请在 easydocument.json 中填写 repo 字段",
        this.describe(),
      );
    }
    const url = `https://api.github.com/repos/${this.pointer.owner}/${this.pointer.repo}/git/trees/${encodeURIComponent(this.pointer.branch)}?recursive=1`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new ContentSourceError(
        `获取文件树失败 (${response.status})`,
        this.describe(),
      );
    }
    const data = (await response.json()) as {
      tree?: Array<{ path: string; type: string; size?: number }>;
    };
    const files = (data.tree ?? [])
      .filter((node) => node.type === "blob")
      .map((node) => ({ path: normalizeSlashes(node.path), size: node.size ?? 0 }));
    return this.scopeToRoot(files);
  }

  /** 把分支全量文件清单裁剪到内容根之下 */
  private scopeToRoot(files: ContentFileInfo[]): ContentFileInfo[] {
    const prefix = this.pointer.rootDir ? `${this.pointer.rootDir}/` : "";
    return files
      .filter((file) => (prefix ? file.path.startsWith(prefix) : true))
      .map((file) => ({
        path: prefix ? file.path.slice(prefix.length) : file.path,
        size: file.size,
      }))
      .filter((file) => file.path);
  }
}
