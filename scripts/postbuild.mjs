/**
 * 构建后处理
 *
 * 1. GitHub Pages 的 SPA 回退
 *    GitHub Pages 对未匹配路径返回根目录的 `404.html`（真实状态码 404）。
 *    把预渲染好的 `index.html` 原样复制过去，浏览器拿到的是**完整可水合**的应用，
 *    客户端路由接管后即可渲染任意 `/docs/...` 深链——这正是 v2.0.1 的 SPA 回退方案。
 *    （URL 仍是被请求的未知路径，因此不能复制某个具体文档页，只能复制首页。）
 * 2. 产物自检：文档 HTML 数量与内容清单一致。
 */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const clientDir = path.resolve("build/client");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * 生成 SPA 回退页
 *
 * 直接复制 index.html：它带有完整的 React Router 上下文与模块脚本，
 * 客户端会用**地址栏里的真实路径**重新跑一次 loader 并渲染。
 */
async function writeSpaFallback() {
  const indexHtml = path.join(clientDir, "index.html");
  if (!(await exists(indexHtml))) {
    console.warn("⚠ 未找到 index.html，跳过 404.html 生成");
    return;
  }

  const manifestPath = path.join(clientDir, "content-manifest.json");
  const manifest = (await exists(manifestPath))
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : null;
  const versions = manifest?.branches?.map((branch) => branch.name) ?? [];
  const baseUrl = "/";

  const { buildLegacyHashScript } = await import("./legacy-hash.mjs");

  let html = await readFile(indexHtml, "utf8");
  // 旧版 hash 链接回退：必须在 React 水合前同步改写地址
  const script = `<script>${buildLegacyHashScript(versions, baseUrl)}</script>`;
  html = html.replace("</head>", `${script}</head>`);

  // 同一个文件同时用于 GitHub Pages 的 404 回退与本地预览的 SPA 回退
  await writeFile(path.join(clientDir, "404.html"), html, "utf8");
  await writeFile(path.join(clientDir, "__spa-fallback.html"), html, "utf8");

  console.log("✓ 已生成 404.html（复制 index.html，支持 SPA 回退与旧版 hash 链接）");
}

async function verifyOutput() {
  const manifestPath = path.join(clientDir, "content-manifest.json");
  if (!(await exists(manifestPath))) return;

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expected = manifest.branches.reduce((sum, branch) => sum + branch.docs.length, 0);
  const branchCount = manifest.branches.length;

  const files = await walk(path.join(clientDir, "docs"));
  const htmlCount = files.filter((file) => file.endsWith("index.html")).length;
  const expectedPages = expected + branchCount;

  const status = htmlCount >= expectedPages ? "✓" : "⚠";
  console.log(
    `${status} 预渲染页面 ${htmlCount} 个（文档 ${expected} 篇 + 版本首页 ${branchCount} 个）`,
  );
  if (htmlCount < expectedPages) {
    console.warn("  部分文档未生成静态页，请检查 prerender 枚举");
  }
}

async function main() {
  await writeSpaFallback();
  await verifyOutput();
}

await main();
