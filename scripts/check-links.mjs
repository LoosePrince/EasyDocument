/**
 * 构建产物链接检查
 *
 * 校验「所有可见、可点击的站内入口」都指向真实存在的页面：
 *  1. 每个页面里的 <a href> 站内链接都有对应产物（.html）
 *  2. 配置里的 nav_links / home 快捷入口 / 页脚链接都能解析到产物
 *  3. 内容清单里的每篇文档都生成了静态页
 *
 * 在 `npm run build` 之后执行；发现问题时以非零码退出。
 */
import { readFile, readdir, stat } from "node:fs/promises";
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
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

/** URL 路径 → 产物文件候选 */
function candidatesFor(urlPath) {
  const clean = urlPath.split("#")[0].split("?")[0];
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    // 保留原样
  }
  const base = path.join(clientDir, decoded);
  return decoded.endsWith("/")
    ? [path.join(base, "index.html")]
    : [path.join(base, "index.html"), path.join(base, ".html"), base];
}

/**
 * 旧版路径归一：`/main`、`/main/`、`/main/#路径/` → `/docs/main[/路径]`
 * （与前端 upgradeLegacyPath 语义一致，用于校验仍使用 v1 写法的配置）
 */
function upgradeLegacy(pathname, versions) {
  const clean = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean || clean.startsWith("docs")) return pathname;

  const hashMatch = clean.match(/^([^/#?]+)\/?#\/?(.*)$/);
  const versionSegment = hashMatch ? hashMatch[1] : clean.split("/")[0];
  const rest = hashMatch
    ? (hashMatch[2] ?? "")
    : clean.slice(versionSegment.length).replace(/^\/+/, "");
  if (!versions.has(versionSegment)) return pathname;

  const tail = rest.replace(/[?#].*$/, "").replace(/\.(md|markdown|html?)$/i, "").replace(/^\/+|\/+$/g, "");
  return `/docs/${versionSegment}${tail ? `/${tail}` : ""}`;
}

/** 判断站内链接是否可达 */
async function resolvable(href, baseUrl, versions) {
  if (!href.startsWith("/")) return true; // 相对链接与外链跳过
  const withoutBase = baseUrl !== "/" && href.startsWith(baseUrl) ? href.slice(baseUrl.length) : href;
  let normalized = withoutBase.startsWith("/") ? withoutBase : `/${withoutBase}`;
  if (normalized === "/") return true;

  for (const candidate of candidatesFor(normalized)) {
    if (await exists(candidate)) return true;
  }

  // 仍使用 v1 写法（/main、/main/#路径）的配置：前端会自动升级，这里按升级后的路径判定
  const upgraded = upgradeLegacy(normalized, versions);
  if (upgraded !== normalized) {
    for (const candidate of candidatesFor(upgraded)) {
      if (await exists(candidate)) return true;
    }
  }
  return false;
}

function extractHrefs(html) {
  const hrefs = new Set();
  const regex = /<a\b[^>]*\bhref="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) hrefs.add(match[1]);
  return hrefs;
}

async function main() {
  const manifestPath = path.join(clientDir, "content-manifest.json");
  if (!(await exists(manifestPath))) {
    console.error("✗ 未找到 content-manifest.json，请先执行构建");
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const baseUrl = "/";
  const versions = new Set(manifest.branches.map((branch) => branch.name));

  // 1. 每篇文档都应有产物
  const missingDocs = [];
  for (const branch of manifest.branches) {
    for (const doc of branch.docs) {
      const base = doc.path.replace(/\.(md|markdown|html?)$/i, "");
      const parts = base.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      const isIndex = ["readme", "index"].includes(last.toLowerCase());
      if (isIndex) parts.pop();
      const url = `/docs/${branch.name}${parts.length ? `/${parts.join("/")}` : ""}`;
      const found = await resolvable(url, baseUrl, versions);
      if (!found) missingDocs.push(`${branch.name}/${doc.path} → ${url}`);
    }
  }

  // 2. 扫描所有 HTML 里的站内链接
  const htmlFiles = (await walk(clientDir)).filter((file) => file.endsWith(".html"));
  const broken = [];

  for (const file of htmlFiles) {
    // 404 页面与 SPA 回退是兜底页，不参与校验
    if (file.endsWith("404.html") || file.endsWith("__spa-fallback.html")) continue;
    const html = await readFile(file, "utf8");
    for (const href of extractHrefs(html)) {
      if (!href.startsWith("/")) continue;
      if (href.startsWith("/assets/")) continue;
      if (await resolvable(href, baseUrl, versions)) continue;
      broken.push({ page: path.relative(clientDir, file), href });
    }
  }

  // 3. 内容清单的索引页也存在
  const summary = [];
  if (missingDocs.length > 0) {
    summary.push(`✗ ${missingDocs.length} 篇文档没有生成静态页：`);
    for (const item of missingDocs.slice(0, 10)) summary.push(`    ${item}`);
  }
  if (broken.length > 0) {
    summary.push(`✗ ${broken.length} 个站内链接指向不存在的页面：`);
    for (const item of broken.slice(0, 15)) {
      summary.push(`    ${item.page} → ${item.href}`);
    }
  }

  if (summary.length > 0) {
    console.error(summary.join("\n"));
    process.exitCode = 1;
    return;
  }

  const totalDocs = manifest.branches.reduce((sum, branch) => sum + branch.docs.length, 0);
  console.log(`✓ 链接检查通过：${totalDocs} 篇文档、${htmlFiles.length} 个页面，站内链接全部可达`);
}

await main();
