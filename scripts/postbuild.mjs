/**
 * 构建后处理
 *
 * 1. 由预渲染的 `/404/index.html` 生成根目录 `404.html`：
 *    GitHub Pages 对未匹配路径返回 404.html（真实状态码 404）。
 *    GitHub Pages 返回 404.html 时 URL 仍是被请求的未知路径，
 *    与预渲染时的 `/404` 不一致 → 客户端水合必然错配（React #418），
 *    因此这里剥掉水合脚本，只保留已静态渲染的标记与样式。
 *    404 页无需交互，链接均为真实 <a href>，去掉 JS 不影响使用。
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

/** 去掉水合相关脚本，保留静态标记与样式 */
function stripHydration(html) {
  return html
    // modulepreload 预加载的是水合 bundle，一并去掉
    .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, "")
    // 入口 module 脚本、React Router 上下文脚本、内联开发提示
    .replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
}

async function main() {
  // 1. 静态 404
  const static404 = path.join(clientDir, "404", "index.html");
  if (await exists(static404)) {
    const html = await readFile(static404, "utf8");
    const stripped = stripHydration(html);
    await writeFile(path.join(clientDir, "404.html"), stripped, "utf8");
    console.log("✓ 已生成 404.html（静态渲染，已去除水合脚本）");
  } else {
    console.warn("⚠ 未找到预渲染的 404 页（/404），跳过 404.html 生成");
  }

  // 2. 自检：文档页数量 vs 内容清单
  const manifestPath = path.join(clientDir, "content-manifest.json");
  if (await exists(manifestPath)) {
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
}

await main();
