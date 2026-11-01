import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { FileText, Pencil } from "lucide-react";
import type { Route } from "./+types/docs-page";
import { loadDocRoute, type BranchLandingData, type DocPageData } from "~/lib/site/page.server";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { Breadcrumbs } from "~/components/layout/breadcrumbs";
import { PrevNext } from "~/components/layout/prev-next";
import { BackToTop, ReadingProgress } from "~/components/layout/reading-progress";
import { SidebarTree } from "~/components/sidebar/sidebar-tree";
import { VersionSwitcher } from "~/components/sidebar/version-switcher";
import { DocGitInfo } from "~/components/sidebar/doc-git-info";
import { TableOfContents } from "~/components/toc/table-of-contents";
import {
  ImageLightbox,
  useDocEnhancements,
  useMermaid,
} from "~/components/markdown/doc-enhancements";
import { EditorPanel } from "~/components/editor/editor-panel";
import { docUrlPath, siteHref } from "~/lib/content/routes";

export async function loader({ params }: LoaderFunctionArgs) {
  const branch = params.branch ?? "";
  const splat = params["*"] ?? "";
  const result = await loadDocRoute({ branch, splat });
  if (!result) {
    throw new Response("Not Found", { status: 404 });
  }
  return result;
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "未找到文档" }];
  if (data.kind === "landing") {
    return [{ title: `${data.landing.branchLabel} · 文档` }];
  }
  return [
    { title: `${data.page.title} · ${data.page.branchLabel}` },
    { name: "description", content: `${data.page.title} - ${data.page.branchLabel} 文档` },
  ];
}

export default function DocsPage() {
  const data = useLoaderData<typeof loader>();
  if (data.kind === "landing") {
    return <BranchLanding landing={data.landing} />;
  }
  return <DocView page={data.page} />;
}

function DocView({ page }: { page: DocPageData }) {
  const data = page;
  const { config } = useSite();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { lightboxSrc, closeLightbox } = useDocEnhancements(contentRef, data.docPath);
  useMermaid(contentRef, config.extensions.mermaid && data.kind === "markdown", data.docPath);

  // 切换文档时滚回顶部（保留锚点）
  useEffect(() => {
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [data.docPath]);

  const canEdit = config.admin.enable;

  return (
    <div className="min-h-screen">
      <ReadingProgress enabled={config.extensions.progress_bar.enable} />

      {config.layout.show_header ? (
        <SiteHeader onOpenSidebar={() => setSidebarOpen(true)} />
      ) : null}

      <div
        className="mx-auto flex max-w-[1600px] gap-6 px-0 lg:px-4"
        style={{
          // 由配置驱动的三栏宽度
          ["--ed-sidebar-width" as string]: config.layout.sidebar_width,
          ["--ed-toc-width" as string]: config.layout.toc_width,
        }}
      >
        {/* 左侧：文档树 */}
        <aside
          className={`fixed inset-y-0 left-0 z-[60] w-[min(88vw,var(--ed-sidebar-width))] shrink-0 overflow-y-auto border-r border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-3 py-4 transition-transform lg:sticky lg:top-[var(--ed-header-height)] lg:z-0 lg:h-[calc(100vh-var(--ed-header-height))] lg:w-[var(--ed-sidebar-width)] lg:translate-x-0 lg:border-none lg:bg-transparent ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="文档侧栏"
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold">文档导航</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
            >
              关闭
            </button>
          </div>

          <VersionSwitcher current={data.branch} className="mb-3" />

          <SidebarTree
            tree={data.tree}
            branch={data.branch}
            activePath={data.docPath}
            onNavigate={() => setSidebarOpen(false)}
          />
        </aside>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />
        ) : null}

        {/* 中间：正文 */}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-2">
          <Breadcrumbs
            branch={data.branch}
            branchLabel={data.branchLabel}
            crumbs={data.breadcrumbs}
            currentTitle={data.title}
          />

          <article className="min-w-0">
            {canEdit ? (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1.5 text-xs text-[var(--ed-text-muted)] transition-colors hover:border-[var(--ed-primary)] hover:text-[var(--ed-primary)]"
                >
                  <Pencil className="size-3.5" />
                  编辑此页
                </button>
              </div>
            ) : null}

            {data.kind === "markdown" ? (
              <div
                ref={contentRef}
                className="doc-content"
                dangerouslySetInnerHTML={{ __html: data.html }}
              />
            ) : (
              <HtmlDocument srcDoc={data.rawHtml ?? ""} title={data.title} />
            )}

            <DocGitInfo git={undefined} editUrl={data.editUrl} />

            <PrevNext branch={data.branch} prev={data.prev} next={data.next} />

            {data.branch !== undefined ? (
              <p className="mt-8 text-xs text-[var(--ed-text-subtle)]">
                当前版本：
                <Link
                  to={docUrlPath({ branch: data.branch, path: "" })}
                  className="text-[var(--ed-primary)] hover:underline"
                >
                  {data.branchLabel}
                </Link>
              </p>
            ) : null}
          </article>
        </main>

        {/* 右侧：目录 */}
        <TableOfContents
          headings={data.toc}
          tocDepth={config.document.toc_depth}
          dynamicExpand={config.document.toc_dynamic_expand}
          className="sticky top-[calc(var(--ed-header-height)+1.5rem)] hidden h-[calc(100vh-var(--ed-header-height)-3rem)] w-[var(--ed-toc-width)] shrink-0 overflow-y-auto py-6 xl:block"
        />
      </div>

      {config.layout.show_footer ? <SiteFooter /> : null}
      <BackToTop enabled={config.navigation.back_to_top} />
      <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />

      {editorOpen ? (
        <EditorPanel
          branch={data.branch}
          docPath={data.docPath}
          initialContent={data.kind === "markdown" ? data.html : (data.rawHtml ?? "")}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * HTML 文档：沙箱 iframe 渲染。
 * 默认禁用脚本（allow-same-origin 与 allow-scripts 同时存在会突破沙箱），
 * 需要交互的文档由用户显式点击后启用脚本。
 */
function HtmlDocument({ srcDoc, title }: { srcDoc: string; title: string }) {
  const [allowScripts, setAllowScripts] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--ed-text-muted)]">
        <span>HTML 文档</span>
        <button
          type="button"
          onClick={() => setAllowScripts((value) => !value)}
          className="rounded border border-[var(--ed-border)] px-2 py-1 transition-colors hover:border-[var(--ed-primary)]"
        >
          {allowScripts ? "禁用脚本" : "启用脚本"}
        </button>
      </div>
      <iframe
        title={title}
        srcDoc={srcDoc}
        sandbox={allowScripts ? "allow-same-origin allow-scripts" : "allow-same-origin"}
        className="h-[75vh] w-full rounded-xl border border-[var(--ed-border)] bg-white"
        loading="lazy"
      />
    </div>
  );
}

/** 版本首页：该版本没有索引页时，列出全部文档 */
function BranchLanding({ landing }: { landing: BranchLandingData }) {
  const { config } = useSite();

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}

      <div className="mx-auto flex max-w-[1600px] gap-6 px-0 lg:px-4">
        <aside className="sticky top-[var(--ed-header-height)] hidden h-[calc(100vh-var(--ed-header-height))] w-[var(--ed-sidebar-width)] shrink-0 overflow-y-auto py-6 lg:block">
          <VersionSwitcher current={landing.branch} className="mb-3" />
          <SidebarTree tree={landing.tree} branch={landing.branch} />
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8">
          <h1 className="text-2xl font-semibold">{landing.branchLabel}</h1>
          <p className="mt-1.5 text-sm text-[var(--ed-text-muted)]">
            共 {landing.docs.length} 篇文档
          </p>

          {landing.docs.length > 0 ? (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {landing.docs.map((doc) => (
                <li key={doc.path}>
                  <Link
                    to={docUrlPath({ branch: landing.branch, path: doc.path.replace(/\.(md|markdown|html?)$/i, "") })}
                    className="flex items-center gap-2 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-3.5 py-2.5 text-sm transition-colors hover:border-[var(--ed-primary)]"
                  >
                    <FileText className="size-4 shrink-0 text-[var(--ed-text-subtle)]" />
                    <span className="truncate">{doc.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--ed-border)] p-10 text-center">
              <p className="text-sm text-[var(--ed-text-muted)]">该版本还没有文档。</p>
              {config.admin.enable ? (
                <Link
                  to={siteHref("/admin", config.site.base_url)}
                  className="mt-3 inline-block text-sm text-[var(--ed-primary)] hover:underline"
                >
                  前往编辑台新建文档
                </Link>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {config.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}
