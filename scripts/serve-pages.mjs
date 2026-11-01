/**
 * 本地预览构建产物，语义对齐 GitHub Pages + SPA 回退：
 *
 *  - 请求目录 → 目录下 index.html
 *  - 请求无扩展名路径 → 先试 `<path>/index.html`，再试 `<path>.html`
 *  - 未预渲染但属于应用内路由（/admin）→ 返回 SPA 回退页（状态 200）
 *  - 其余未匹配 → 返回 404.html（状态 404）
 *
 * 真实 GitHub Pages 无法做 SPA 回退，因此 /admin 在线上需要 404.html 兜底；
 * 这里用回退页模拟开发体验，并在文档中说明差异。
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const port = Number(process.env.PORT ?? 4173);
const root = path.resolve(process.argv[2] ?? "build/client");

/** 未预渲染、但需要客户端渲染的路径前缀 */
const SPA_PREFIXES = ["/admin"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".data": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const base = path.join(root, decoded);
  if (!base.startsWith(root)) return null;

  const candidates = decoded.endsWith("/")
    ? [path.join(base, "index.html")]
    : [base, `${base}.html`, path.join(base, "index.html")];

  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

function send(res, status, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(status, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const pathname = url.pathname;

  const filePath = await resolveFile(pathname);
  if (filePath) {
    send(res, 200, filePath);
    return;
  }

  // 应用内路由：交给 SPA 回退（模拟 Vercel/Netlify 的 rewrite）
  if (SPA_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const fallback = path.join(root, "__spa-fallback.html");
    if (await isFile(fallback)) {
      send(res, 200, fallback);
      return;
    }
  }

  const notFound = path.join(root, "404.html");
  if (await isFile(notFound)) {
    send(res, 404, notFound);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
