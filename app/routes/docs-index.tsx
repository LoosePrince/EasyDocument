import { Link, useLoaderData } from "react-router";
import { BookOpen, ChevronRight } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { docUrlPath, siteHref } from "~/lib/content/routes";
import { collectDocPaths } from "~/lib/content/types";

export function loader() {
  // 版本列表来自根 loader 的缓存数据，这里只做展示
  return {};
}

export function meta() {
  return [{ title: "文档" }];
}

export default function DocsIndex() {
  const { config, branches, defaultBranch } = useSite();
  useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}

      <main className="mx-auto max-w-4xl px-5 py-12">
        <header className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="size-6 text-[var(--ed-primary)]" />
            文档
          </h1>
          <p className="mt-2 text-sm text-[var(--ed-text-muted)]">
            共 {branches.length} 个版本。选择版本开始阅读。
          </p>
        </header>

        <ul className="space-y-3">
          {branches.map((branch, index) => {
            const docs = collectDocPaths(branch.tree);
            return (
              <li key={branch.name}>
                <Link
                  to={docUrlPath({ branch: branch.name, path: "" })}
                  className="flex items-center gap-3 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4 transition-colors hover:border-[var(--ed-primary)]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--ed-primary-soft)] text-sm font-semibold text-[var(--ed-primary)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {branch.label}
                      {branch.name === defaultBranch ? (
                        <span className="rounded bg-[var(--ed-primary-soft)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--ed-primary)]">
                          默认
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--ed-text-muted)]">
                      {docs.length} 篇文档
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--ed-text-subtle)]" />
                </Link>
              </li>
            );
          })}
        </ul>

        {branches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--ed-border)] p-10 text-center">
            <p className="text-sm text-[var(--ed-text-muted)]">数据分支中还没有任何文档。</p>
            {config.admin.enable ? (
              <Link
                to={siteHref("/admin", config.site.base_url)}
                className="mt-3 inline-block text-sm text-[var(--ed-primary)] hover:underline"
              >
                前往编辑台新建文档
              </Link>
            ) : null}
          </div>
        ) : null}
      </main>

      {config.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}
