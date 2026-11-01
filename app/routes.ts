import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // 版本索引页：/docs
  route("docs", "routes/docs-index.tsx"),
  // 文档页（含版本根）：/docs/{version} 与 /docs/{version}/{path...}
  route("docs/:branch/*", "routes/docs-page.tsx", { id: "docs-page" }),
  // 网页端编辑台（不预渲染，noindex）
  route("admin/*", "routes/admin.tsx", { id: "admin" }),
  // 静态 404 页（构建后落成 404.html，供 GitHub Pages 未匹配路径使用）
  route("404", "routes/not-found.tsx", { id: "not-found-static" }),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
