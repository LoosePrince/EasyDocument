/**
 * 本地预览构建产物，语义对齐 GitHub Pages：
 *
 *  - 请求目录 → 目录下 index.html
 *  - 请求无扩展名路径 → 先试 `<path>/index.html`，再试 `<path>.html`
 *  - 未匹配 → 返回根目录 404.html 且状态码 404（不回落 SPA）
 *
 * 用途：`npm run preview`，以及 Playwright 的 webServer。
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const port = Number(process.env.PORT ?? 4173);
const root = path.resolve(process.argv[2] ?? "build/client");

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

/** 依次尝试候选路径，返回命中的文件 */
async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const base = path.join(root, decoded);
  // 防目录穿越
  if (!base.startsWith(root)) return null;

  const candidates = [];
  if (decoded.endsWith("/")) {
    candidates.push(path.join(base, "index.html"));
  } else {
    candidates.push(base, `${base}.html`, path.join(base, "index.html"));
  }

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
  const filePath = await resolveFile(url.pathname);

  if (filePath) {
    send(res, 200, filePath);
    return;
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
  console.log(`Serving ${root} at http://localhost:${port} (GitHub Pages semantics)`);
});
