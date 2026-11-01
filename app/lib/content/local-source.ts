/**
 * 构建期内容源：读取 data 分支的本地工作区。
 *
 * 优先级：
 *  1. EASYDOCUMENT_DATA_DIR（CI 中把 data 分支检出到 .data/）
 *  2. 本地 `.data/` 目录（开发者手动 `git worktree add .data origin/data`）
 *  3. 远程（raw.githubusercontent.com）——见 remote-source.ts
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ContentSourceError, type ContentFileInfo, type ContentSource } from "./source";
import { normalizeSlashes } from "./pointer";

export interface LocalSourceOptions {
  /** 内容根目录的绝对路径 */
  dataDir: string;
  /** 内容根在本地目录中的相对前缀（dataDir 指向仓库根时用于定位 config.js 所在目录） */
  prefix?: string;
  /** 额外跳过的目录/文件名 */
  ignore?: string[];
}

export class LocalContentSource implements ContentSource {
  private readonly dataDir: string;
  private readonly prefix: string;
  private readonly ignore: Set<string>;

  constructor(options: LocalSourceOptions) {
    this.dataDir = path.resolve(options.dataDir);
    this.prefix = normalizeSlashes(options.prefix ?? "");
    this.ignore = new Set(options.ignore ?? []);
  }

  describe() {
    return `local:${this.dataDir}${this.prefix ? `/${this.prefix}` : ""}`;
  }

  private get root(): string {
    return this.prefix ? path.resolve(this.dataDir, this.prefix) : this.dataDir;
  }

  async listFiles(): Promise<ContentFileInfo[]> {
    const collected: ContentFileInfo[] = [];

    const walk = async (dir: string, relativeDir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        throw new ContentSourceError(`读取目录失败: ${relativeDir || "."}`, this.describe(), {
          cause: error,
        });
      }
      for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        if (this.ignore.has(entry.name)) continue;
        if (entry.name.startsWith(".")) continue;
        const relative = normalizeSlashes(
          [relativeDir, entry.name].filter(Boolean).join("/"),
        );
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute, relative);
        } else if (entry.isFile()) {
          const info = await stat(absolute);
          collected.push({ path: relative, size: info.size });
        }
      }
    };

    await walk(this.root, "");
    return collected.sort((a, b) => a.path.localeCompare(b.path));
  }

  async readFile(filePath: string): Promise<string> {
    const clean = normalizeSlashes(filePath);
    const absolute = path.resolve(this.root, clean);
    if (!absolute.startsWith(this.root)) {
      throw new ContentSourceError(`非法路径: ${filePath}`, this.describe());
    }
    try {
      return await readFile(absolute, "utf8");
    } catch (error) {
      throw new ContentSourceError(`读取文件失败: ${filePath}`, this.describe(), { cause: error });
    }
  }
}
