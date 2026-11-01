import { Link } from "react-router";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { siteHref } from "~/lib/content/routes";

export function meta() {
  return [{ title: "页面不存在" }, { name: "robots", content: "noindex" }];
}

export default function NotFound() {
  const { config } = useSite();

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}
      <main className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 px-6 py-32 text-center">
        <p className="text-7xl font-semibold text-[var(--ed-primary)]">404</p>
        <h1 className="text-xl font-medium">页面不存在</h1>
        <p className="text-sm text-[var(--ed-text-muted)]">
          该文档可能已被移动或删除，请从文档首页重新查找。
        </p>
        <div className="mt-2 flex gap-2">
          <Link
            to={siteHref("/", config.site.base_url)}
            className="rounded-lg bg-[var(--ed-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            返回首页
          </Link>
          <Link
            to={siteHref("/docs", config.site.base_url)}
            className="rounded-lg border border-[var(--ed-border)] px-4 py-2 text-sm font-medium"
          >
            浏览文档
          </Link>
        </div>
      </main>
      {config.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}
