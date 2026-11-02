import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import { FileText, Pencil, Plus } from "lucide-react";
import type { Route } from "./+types/docs-page";
import { loadDocRoute, type BranchLandingData, type DocPageData } from "~/lib/site/page.server";
import { useSite } from "~/components/providers/config-provider";
import { useEditorContext } from "~/lib/editor/editor-store";
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
import { InlineDocEditor } from "~/components/editor/inline-doc-editor";
import { EditToolbar } from "~/components/editor/edit-toolbar";
import { DocContextMenu } from "~/components/markdown/doc-context-menu";
import { docUrlPath, siteHref } from "~/lib/content/routes";
import { useGlobalShortcuts } from "~/lib/editor/shortcuts";
import NotFound from "./not-found";

export async function loader({ params }: LoaderFunctionArgs) {
  const branch = params.branch ?? "";
  const splat = params["*"] ?? "";

  try {
    const result = await loadDocRoute({ branch, splat });
    if (!result) {
      throw new Response("Not Found", { status: 404 });
    }
    return result;
  } catch (error) {
    if (error instanceof Response) throw error;
    // 浏览器端缺少该路径的预渲染数据（例如未预渲染的深链，经 404.html 回退而来）：
    // 此时构建期模块（node:fs）不可用，统一当作 404，避免显示「页面加载失败」
    if (typeof window !== "undefined") {
      throw new Response("Not Found", { status: 404 });
    }
    throw error;
  }
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

/**
 * 文档路由的错误边界
 *
 * 深路径经 404.html（= index.html 副本）回退时，浏览器端拿不到该路径的
 * 预渲染数据，loader 会抛 404。这里渲染统一的「页面不存在」页，
 * 而不是落到根级「页面加载失败」。
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const aliasTarget = useAliasRedirect();
  if (aliasTarget) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 text-sm text-[var(--ed-text-muted)]">
        正在跳转到 <code>{aliasTarget}</code>…
      </main>
    );
  }

  // 1. 明确的 404
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

  // 2. 浏览器端缺少该路径的预渲染数据（深链经 404.html 回退而来）：
  //    客户端路由找不到 `docs-page` 的 loader 结果，等价于「页面不存在」。
  if (error instanceof Error && /No result found for routeId/.test(error.message)) {
    return <NotFound />;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-7xl font-semibold text-[var(--ed-primary)]">错误</p>
      <h1 className="text-xl font-medium">页面加载失败</h1>
      <p className="text-sm text-[var(--ed-text-muted)]">发生意外错误，请稍后重试。</p>
      <a
        href={siteHref("/", "/")}
        className="mt-2 rounded-lg bg-[var(--ed-primary)] px-4 py-2 text-sm font-medium text-white"
      >
        返回首页
      </a>
    </main>
  );
}

/**
 * `/docs/main/参考/README` 这类「未折叠索引页」地址并不在预渲染清单里，
 * 但语义上等价于 `/docs/main/参考`。这里在浏览器端做一次 replace 跳转，
 * 让外部旧链接（以及手工输入带 README 的地址）仍然可用。
 */
function useAliasRedirect(): string | null {
  const location = useLocation();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const match = location.pathname.match(
      /^(.*\/)(README|readme|index|INDEX|Index)(\.(?:md|markdown|html?))?$/,
    );
    if (!match) return;
    const next = `${match[1].replace(/\/+$/, "")}${location.search}${location.hash}`;
    setTarget(next);
    window.location.replace(next);
  }, [location.pathname, location.search, location.hash]);

  return target;
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
  const editor = useEditorContext();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useGlobalShortcuts();

  const { lightboxSrc, closeLightbox } = useDocEnhancements(contentRef, data.docPath);
  useMermaid(contentRef, config.extensions.mermaid && data.kind === "markdown", data.docPath);

  useEffect(() => {
    if (editor.editing) return;
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [data.docPath, editor.editing]);

  const canEdit = editor.canEdit;
  const draft = editor.getDraft(data.docPath);
  const editingThis = editor.editing && draft?.kind !== "delete";

  return (
    <div className="min-h-screen">
      <ReadingProgress enabled={config.extensions.progress_bar.enable && !editor.editing} />

      {config.layout.show_header ? (
        <SiteHeader onOpenSidebar={() => setSidebarOpen(true)} />
      ) : null}
      <EditToolbar />

      <div
        className="mx-auto flex max-w-[1600px] gap-6 px-0 lg:px-4"
        style={{
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
            onOpenDoc={(path) => {
              navigate(
                docUrlPath({ branch: data.branch, path: path.replace(/\.(md|markdown|html?)$/i, "") }),
              );
              editor.setEditing(true);
            }}
          />
        </aside>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />
        ) : null}

        {/* 中间：正文 / 编辑区 */}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-2">
          <Breadcrumbs
            branch={data.branch}
            branchLabel={data.branchLabel}
            crumbs={data.breadcrumbs}
            currentTitle={editingThis ? draft?.title ?? data.title : data.title}
          />

          {canEdit && !editor.editing ? (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => editor.setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1.5 text-xs text-[var(--ed-text-muted)] transition-colors hover:border-[var(--ed-primary)] hover:text-[var(--ed-primary)]"
              >
                <Pencil className="size-3.5" />
                编辑此页
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.setEditing(true);
                  navigate("/admin");
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1.5 text-xs text-[var(--ed-text-muted)] transition-colors hover:border-[var(--ed-primary)] hover:text-[var(--ed-primary)]"
              >
                <Plus className="size-3.5" />
                新建 / 管理
              </button>
            </div>
          ) : null}

          {editingThis ? (
            <InlineDocEditor
              branch={data.branch}
              docPath={data.docPath}
              initialContent={data.source}
              kind={data.kind}
              title={data.title}
              onExit={() => editor.setEditing(false)}
            />
          ) : (
            <DocContextMenu
              title={data.title}
              url={typeof window !== "undefined" ? window.location.href : data.canonicalPath}
              headings={data.toc}
              onEdit={canEdit ? () => editor.setEditing(true) : undefined}
              className="min-w-0"
            >
              {draft?.kind === "delete" ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  此文档已标记为「待删除」，提交后将移除。
                  <button
                    type="button"
                    onClick={() => editor.removeDraft(draft.path)}
                    className="ml-auto underline"
                  >
                    撤销删除
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
                <HtmlDocument
                  srcDoc={data.rawHtml ?? ""}
                  title={data.title}
                  allowScripts={config.extensions.html_scripts}
                />
              )}

              <DocGitInfo git={data.git} editUrl={data.editUrl} />

              <PrevNext branch={data.branch} prev={data.prev} next={data.next} />

              <p className="mt-8 text-xs text-[var(--ed-text-subtle)]">
                当前版本：
                <Link
                  to={docUrlPath({ branch: data.branch, path: "" })}
                  className="text-[var(--ed-primary)] hover:underline"
                >
                  {data.branchLabel}
                </Link>
              </p>
            </DocContextMenu>
          )}
        </main>

        {/* 右侧：目录（编辑时隐藏，避免干扰） */}
        {!editor.editing ? (
          <TableOfContents
            headings={data.toc}
            tocDepth={config.document.toc_depth}
            dynamicExpand={config.document.toc_dynamic_expand}
            className="sticky top-[calc(var(--ed-header-height)+1.5rem)] hidden h-[calc(100vh-var(--ed-header-height)-3rem)] w-[var(--ed-toc-width)] shrink-0 overflow-y-auto py-6 xl:block"
          />
        ) : null}
      </div>

      {config.layout.show_footer ? <SiteFooter /> : null}
      <BackToTop enabled={config.navigation.back_to_top && !editor.editing} />
      <ImageLightbox src={lightboxSrc} onClose={closeLightbox} />
    </div>
  );
}

/**
 * HTML 文档
 *
 * v2.0.1 起不再为「安全」做限制：脚本、内联样式、iframe 等一律执行，
 * 与直接打开 .html 文件的效果一致（`extensions.html_scripts=false` 可关闭脚本）。
 * 仍有 `<base target="_parent">` 之类的处理：链接默认在新标签打开，避免把站点导航走丢。
 */
function HtmlDocument({
  srcDoc,
  title,
  allowScripts,
}: {
  srcDoc: string;
  title: string;
  allowScripts: boolean;
}) {
  const prepared = useMemo(() => prepareHtmlDocument(srcDoc), [srcDoc]);

  return (
    <iframe
      title={title}
      srcDoc={prepared}
      // allow-same-origin 让文档能读取自身样式与字体；allow-scripts 让交互生效
      sandbox={
        allowScripts
          ? "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
          : "allow-same-origin allow-forms allow-popups allow-modals"
      }
      className="min-h-[70vh] w-full rounded-xl border border-[var(--ed-border)] bg-white"
      loading="lazy"
    />
  );
}

/** 注入 base 目标，避免 HTML 文档里的链接在 iframe 内打开 */
function prepareHtmlDocument(html: string): string {
  if (/<base\b/i.test(html)) return html;
  const base = '<base target="_blank">';
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, (match) => `${match}${base}`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${base}</head><body>${html}</body></html>`;
}

/** 版本首页：该版本没有索引页时，列出全部文档 */
function BranchLanding({ landing }: { landing: BranchLandingData }) {
  const { config } = useSite();
  const editor = useEditorContext();

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}
      <EditToolbar />

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
                    to={docUrlPath({
                      branch: landing.branch,
                      path: doc.path.replace(/\.(md|markdown|html?)$/i, ""),
                    })}
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
              {editor.canEdit ? (
                <button
                  type="button"
                  onClick={() => editor.setEditing(true)}
                  className="mt-3 inline-block text-sm text-[var(--ed-primary)] hover:underline"
                >
                  在侧栏新建第一篇文档
                </button>
              ) : (
                <Link
                  to={siteHref("/admin", config.site.base_url)}
                  className="mt-3 inline-block text-sm text-[var(--ed-primary)] hover:underline"
                >
                  前往编辑台
                </Link>
              )}
            </div>
          )}
        </main>
      </div>

      {config.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}
