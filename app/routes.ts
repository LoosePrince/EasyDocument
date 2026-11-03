import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // 版本索引页：/docs-{站点语言}
  route(":docsPrefix", "routes/docs-index.tsx", { id: "docs-index" }),
  // 文档页：/docs-{站点语言}/{version}[/{文档语言}]/{path...}
  route(":docsPrefix/:branch/*", "routes/docs-page.tsx", { id: "docs-page" }),
  // 旧链接：/docs 与 /docs/{version}/...（客户端会跳转到带站点语言的新地址）
  route("docs", "routes/docs-index-legacy.tsx", { id: "docs-index-legacy" }),
  route("docs/:branch/*", "routes/docs-legacy.tsx", { id: "docs-page-legacy" }),
  // 网页端编辑台（不预渲染，noindex）
  route("admin/*", "routes/admin.tsx", { id: "admin" }),
  // 静态 404 页（构建后落成 404.html，供 GitHub Pages 未匹配路径使用）
  route("404", "routes/not-found.tsx", { id: "not-found-static" }),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
