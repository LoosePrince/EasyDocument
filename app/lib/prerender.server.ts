/**
 * SSG 入口：枚举所有需要预渲染的文档路径，并写出运行期需要的静态产物。
 *
 * 在 react-router.config.ts 的 prerender() 中调用。
 * 产物写入构建输出目录（build/client）：
 *   - content-manifest.json    仓库指针 + 版本与文档清单
 *   - search-index.<branch>.json  每个版本的搜索索引
 */
import { loadSiteData } from "./site/load.server";
import { normalizeDocPath } from "./content/routes";
import { collectDocPaths } from "./content/types";
import { buildContentManifest, buildSearchIndexFile } from "./site/load.server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PrepareResult {
  paths: string[];
  artifactDir: string;
}

export async function enumerateDocPaths(): Promise<string[]> {
  const site = await loadSiteData();
  const paths = new Set<string>();
  const indexPages = site.config.document.index_pages;
  const documentLanguages = site.config.i18n.document_languages.map((lang) => lang.code);

  for (const language of documentLanguages) {
    paths.add(`/docs-${language}`);
  }

  for (const branch of site.branches) {
    // 新地址：/docs-{文档语言}/{version}/...
    for (const language of branch.languages) {
      const variant = branch.variants.get(language);
      if (!variant) continue;
      paths.add(`/docs-${language}/${branch.name}`);
      for (const doc of collectDocPaths(variant.tree)) {
        const route = normalizeDocPath(doc.path, indexPages, branch.name);
        paths.add(
          `/${[`docs-${language}`, route.branch, route.path].filter(Boolean).join("/")}`.replace(
            /\/{2,}/g,
            "/",
          ),
        );
      }
    }

    // 旧地址：/docs/{version}/...（客户端会跳转到 /docs-{文档语言}/...）
    paths.add(`/docs/${branch.name}`);
    for (const doc of collectDocPaths(branch.tree)) {
      const route = normalizeDocPath(doc.path, indexPages, branch.name);
      paths.add(
        `/${["docs", route.branch, route.path].filter(Boolean).join("/")}`.replace(/\/{2,}/g, "/"),
      );
    }
  }

  paths.add("/docs");
  return [...paths].sort();
}

/** 生成运行期产物（写入客户端构建目录） */
export async function writeRuntimeArtifacts(
  projectRoot: string,
  relativeOutDir: string,
): Promise<string[]> {
  const site = await loadSiteData();
  const outputDir = path.resolve(projectRoot, relativeOutDir);
  await mkdir(outputDir, { recursive: true });

  const written: string[] = [];

  const manifestPath = path.join(outputDir, "content-manifest.json");
  await writeFile(manifestPath, JSON.stringify(buildContentManifest(site), null, 2), "utf8");
  written.push(manifestPath);

  for (const branch of site.branches) {
    const filePath = path.join(outputDir, `search-index.${branch.name}.json`);
    await writeFile(filePath, JSON.stringify(buildSearchIndexFile(branch)), "utf8");
    written.push(filePath);
  }

  return written;
}
