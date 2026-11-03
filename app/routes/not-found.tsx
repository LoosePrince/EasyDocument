import { Link } from "react-router";
import { useRouteLoaderData } from "react-router";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { siteHref } from "~/lib/content/routes";
import type { RootLoaderData } from "~/root";

export function meta() {
  return [{ title: "页面不存在" }, { name: "robots", content: "noindex" }];
}

/**
 * 404 页面
 *
 * 既用于 `/404` 路由，也被文档路由的 ErrorBoundary 复用。
 * ErrorBoundary 渲染在 ConfigProvider 之外，因此这里不能依赖 `useSite()`，
 * 改成读取 root loader 数据并做空值兜底（没有顶栏/页脚时只渲染正文）。
 */
export default function NotFound() {
  const data = useRouteLoaderData("root") as RootLoaderData | undefined;
  const config = data?.config;
  const baseUrl = config?.site.base_url ?? "/";
  const docsPath = `/docs-${config?.i18n.default_document_language ?? "zh-CN"}`;

  return (
    <div className="min-h-screen">
      {config?.layout.show_header ? <SiteHeader /> : null}
      <main className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 px-6 py-32 text-center">
        <p className="text-7xl font-semibold text-[var(--ed-primary)]">404</p>
        <h1 className="text-xl font-medium">页面不存在</h1>
        <p className="text-sm text-[var(--ed-text-muted)]">
          该文档可能已被移动或删除，请从文档首页重新查找。
        </p>
        <div className="mt-2 flex gap-2">
          <Link
            to={siteHref("/", baseUrl)}
            className="rounded-lg bg-[var(--ed-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            返回首页
          </Link>
          <Link
            to={siteHref(docsPath, baseUrl)}
            className="rounded-lg border border-[var(--ed-border)] px-4 py-2 text-sm font-medium"
          >
            浏览文档
          </Link>
        </div>
      </main>
      {config?.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}
