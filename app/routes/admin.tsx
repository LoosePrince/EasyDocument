import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FilePlus2,
  FolderTree,
  GitCommitHorizontal,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SiteFooter } from "~/components/layout/site-footer";
import { useEditorContext } from "~/lib/editor/editor-store";
import { TokenForm } from "~/components/editor/github-auth";
import { ConfigEditor } from "~/components/editor/config-editor";
import { EditToolbar } from "~/components/editor/edit-toolbar";
import { assertSafeDocPath } from "~/lib/editor/operations";
import { docUrlPath } from "~/lib/content/routes";
import { stripExtension, type DocsNode } from "~/lib/content/types";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: "控制台" }, { name: "robots", content: "noindex" }];
}

type Tab = "overview" | "docs" | "config" | "deploy";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "总览", icon: <LayoutDashboard className="size-4" /> },
  { id: "docs", label: "文档管理", icon: <FolderTree className="size-4" /> },
  { id: "config", label: "站点配置", icon: <Settings2 className="size-4" /> },
  { id: "deploy", label: "构建部署", icon: <Activity className="size-4" /> },
];

/** 控制台：总览 / 文档管理 / 站点配置 / 构建部署 */
export default function AdminPage() {
  const { config, branches, defaultBranch, pointer } = useSite();
  const editor = useEditorContext();
  const [tab, setTab] = useState<Tab>("overview");

  if (!config.admin.enable) {
    return (
      <div className="min-h-screen">
        {config.layout.show_header ? <SiteHeader /> : null}
        <main className="mx-auto max-w-md px-5 py-24 text-center">
          <ShieldAlert className="mx-auto mb-3 size-8 text-[var(--ed-text-subtle)]" />
          <p className="text-sm text-[var(--ed-text-muted)]">
            控制台已在配置中关闭（admin.enable = false）。
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}
      <EditToolbar />

      <main className="mx-auto max-w-6xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">控制台</h1>
            <p className="mt-1 text-xs text-[var(--ed-text-muted)]">
              {pointer.owner}/{pointer.repo} · 内容分支 <code>{pointer.branch}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => editor.setEditing(!editor.editing)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              editor.editing
                ? "border border-[var(--ed-border)] text-[var(--ed-text-muted)]"
                : "bg-[var(--ed-primary)] text-white",
            )}
          >
            {editor.editing ? "退出编辑模式" : "进入编辑模式"}
          </button>
        </header>

        {!editor.token ? (
          <section className="mx-auto max-w-lg rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5">
            <h2 className="mb-3 text-sm font-semibold">连接 GitHub</h2>
            <TokenForm
              onSubmit={editor.signIn}
              loading={editor.authLoading}
              error={editor.authError}
            />
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
            <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="控制台导航">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    tab === item.id
                      ? "bg-[var(--ed-primary-soft)] font-medium text-[var(--ed-primary)]"
                      : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="min-w-0">
              {tab === "overview" ? (
                <Overview onNavigate={setTab} />
              ) : tab === "docs" ? (
                <DocManager branches={branches} defaultBranch={defaultBranch} />
              ) : tab === "config" ? (
                <ConfigEditor client={editor.client} repo={editor.repo} dataBranch={pointer.branch} />
              ) : (
                <DeployPanel />
              )}
            </div>
          </div>
        )}
      </main>

      {config.layout.show_footer ? <SiteFooter /> : null}
    </div>
  );
}

/* ---------------- 总览 ---------------- */

function Overview({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { branches, defaultBranch, pointer, config } = useSite();
  const editor = useEditorContext();

  const totalDocs = branches.reduce((sum, branch) => sum + countDocs(branch.tree), 0);

  const stats = [
    { label: "文档总数", value: String(totalDocs), icon: <FilePlus2 className="size-4" /> },
    { label: "版本数", value: String(branches.length), icon: <FolderTree className="size-4" /> },
    {
      label: "待提交修改",
      value: String(editor.drafts.length),
      icon: <GitCommitHorizontal className="size-4" />,
    },
    {
      label: "编辑入口",
      value: config.admin.enable ? "开启" : "关闭",
      icon: <Settings2 className="size-4" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4"
          >
            <span className="text-[var(--ed-text-subtle)]">{stat.icon}</span>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-[var(--ed-text-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-3 text-sm font-semibold">快捷操作</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <QuickAction
            title="管理文档"
            description="新建、删除，或回到侧栏就地编辑"
            onClick={() => onNavigate("docs")}
          />
          <QuickAction
            title="修改站点配置"
            description="表单或直接编辑 config.js"
            onClick={() => onNavigate("config")}
          />
          <QuickAction
            title="触发站点重建"
            description="提交内容后让线上生效"
            onClick={() => onNavigate("deploy")}
          />
          <QuickAction
            title={`打开默认版本「${defaultBranch}」`}
            description="回到文档浏览并就地编辑"
            href={docUrlPath({ branch: defaultBranch, path: "" })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-2 text-sm font-semibold">内容来源</h2>
        <dl className="grid gap-2 text-xs text-[var(--ed-text-muted)] sm:grid-cols-2">
          <div>
            <dt className="text-[var(--ed-text-subtle)]">仓库</dt>
            <dd className="font-mono">
              {pointer.owner || "—"}/{pointer.repo || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ed-text-subtle)]">内容分支 / 配置</dt>
            <dd className="font-mono">
              {pointer.branch}:{pointer.configPath}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ed-text-subtle)]">文档根</dt>
            <dd className="font-mono">{pointer.rootDir || "(分支根)"}</dd>
          </div>
          <div>
            <dt className="text-[var(--ed-text-subtle)]">已连接账号</dt>
            <dd>{editor.user?.login ?? "—"}</dd>
          </div>
        </dl>
        {pointer.owner && pointer.repo ? (
          <a
            href={`https://github.com/${pointer.owner}/${pointer.repo}/tree/${pointer.branch}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--ed-primary)] hover:underline"
          >
            在 GitHub 查看内容分支
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </section>
    </div>
  );
}

function QuickAction({
  title,
  description,
  onClick,
  href,
}: {
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "group flex items-center gap-3 rounded-lg border border-[var(--ed-border)] px-3 py-2.5 text-left transition-colors hover:border-[var(--ed-primary)]";

  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--ed-text-muted)]">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--ed-text-subtle)] transition-transform group-hover:translate-x-0.5" />
    </>
  );

  return href ? (
    <Link to={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/* ---------------- 文档管理 ---------------- */

function DocManager({
  branches,
  defaultBranch,
}: {
  branches: Array<{ name: string; label: string; tree: DocsNode; docCount: number }>;
  defaultBranch: string;
}) {
  const { config } = useSite();
  const editor = useEditorContext();
  const [activeBranch, setActiveBranch] = useState(defaultBranch);
  const [newPath, setNewPath] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const branch = branches.find((item) => item.name === activeBranch) ?? branches[0];
  const tree = useMemo(() => (branch ? editor.previewTree(branch.tree) : null), [branch, editor]);
  const docs = useMemo(() => (tree ? collectDocs(tree) : []), [tree]);

  const handleCreate = () => {
    if (!branch) return;
    try {
      const safe = assertSafeDocPath(newPath, config.document.supported_extensions);
      const fullPath = `${branch.name}/${safe}`;
      if (editor.drafts.some((draft) => draft.path === fullPath)) {
        setFeedback("该路径已在待提交列表中");
        return;
      }
      const title = safe.split("/").pop()?.replace(/\.(md|html)$/i, "") ?? "新文档";
      editor.saveDraft({
        path: fullPath,
        branch: branch.name,
        kind: "create",
        content: `# ${title}\n\n在这里开始编写内容。\n`,
        title,
        format: safe.endsWith(".html") ? "html" : "md",
      });
      setFeedback(`已加入待提交：${fullPath}`);
      setNewPath("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "路径不合法");
    }
  };

  if (!branch || !tree) {
    return <p className="text-sm text-[var(--ed-text-muted)]">该版本不存在。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {branches.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setActiveBranch(item.name)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs transition-colors",
              item.name === activeBranch
                ? "bg-[var(--ed-primary)] text-white"
                : "border border-[var(--ed-border)] text-[var(--ed-text-muted)] hover:border-[var(--ed-primary)]",
            )}
          >
            {item.label}
            <span className="ml-1.5 opacity-70">{item.docCount}</span>
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-2 text-sm font-semibold">新建文档</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreate();
            }}
            placeholder="使用指南/新章节.md"
            aria-label="文档路径"
            className="min-w-48 flex-1 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--ed-primary)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-sm font-medium text-white"
          >
            加入待提交
          </button>
        </div>
        <p className="mt-1.5 text-xs text-[var(--ed-text-subtle)]">
          路径相对于版本目录，支持 {config.document.supported_extensions.join(" / ")}。
        </p>
        {feedback ? <p className="mt-1.5 text-xs text-[var(--ed-text-muted)]">{feedback}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--ed-border)] bg-[var(--ed-bg-subtle)]/60 text-xs text-[var(--ed-text-muted)]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">文档</th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">路径</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => {
              const draft = editor.getDraft(doc.path);
              return (
                <tr key={doc.path} className="border-b border-[var(--ed-border)] last:border-0">
                  <td className="max-w-56 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="truncate">{doc.title}</span>
                      {draft ? <DraftTag kind={draft.kind} /> : null}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[11px] text-[var(--ed-text-subtle)] sm:table-cell">
                    {doc.path}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={docUrlPath({ branch: activeBranch, path: stripExtension(doc.path) })}
                        className="rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-primary)]"
                      >
                        打开
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (draft?.kind === "create") {
                            editor.removeDraft(doc.path);
                            return;
                          }
                          editor.saveDraft({
                            path: doc.path,
                            branch: activeBranch,
                            kind: "delete",
                            title: doc.title,
                          });
                        }}
                        className="rounded-md p-1 text-[var(--ed-text-subtle)] hover:bg-red-500/10 hover:text-red-500"
                        aria-label={`删除 ${doc.path}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-sm text-[var(--ed-text-subtle)]">
                  该版本还没有文档。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-[var(--ed-text-subtle)]">
        删除与新建都会先进入待提交列表，统一在顶部工具条提交。
      </p>
    </div>
  );
}

function DraftTag({ kind }: { kind: "create" | "update" | "delete" }) {
  const meta = {
    create: { text: "新增", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    update: { text: "修改", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    delete: { text: "删除", className: "bg-red-500/15 text-red-500" },
  }[kind];

  return (
    <span className={cn("rounded px-1 py-0.5 text-[10px]", meta.className)}>{meta.text}</span>
  );
}

/* ---------------- 构建部署 ---------------- */

interface WorkflowRun {
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

function DeployPanel() {
  const editor = useEditorContext();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const timer = useRef<number | null>(null);

  const refresh = async () => {
    if (!editor.client) return;
    setPolling(true);
    setError(null);
    try {
      const latest = await editor.client.latestRun(editor.repo, "deploy.yml", "main");
      setRun(latest);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "查询失败");
    } finally {
      setPolling(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.client]);

  const trigger = async () => {
    setError(null);
    try {
      await editor.rebuild();
      timer.current = window.setInterval(() => void refresh(), 5000);
      window.setTimeout(() => {
        if (timer.current) window.clearInterval(timer.current);
        setPolling(false);
      }, 120_000);
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : "触发失败");
    }
  };

  const statusMeta =
    run?.conclusion === "success"
      ? { text: "成功", className: "text-emerald-500" }
      : run?.status === "in_progress" || run?.status === "queued"
        ? { text: "进行中", className: "text-amber-500" }
        : run
          ? { text: run.conclusion ?? run.status, className: "text-[var(--ed-text-muted)]" }
          : { text: "未知", className: "text-[var(--ed-text-subtle)]" };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">站点重建</h2>
            <p className="mt-0.5 text-xs text-[var(--ed-text-muted)]">
              触发 <code>deploy.yml</code>，用内容分支当前状态重新预渲染并发布。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1.5 text-xs text-[var(--ed-text-muted)]"
            >
              {polling ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              刷新状态
            </button>
            <button
              type="button"
              onClick={() => void trigger()}
              disabled={editor.rebuilding || editor.dirty}
              title={editor.dirty ? "请先提交未保存的修改" : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {editor.rebuilding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              立即重建
            </button>
          </div>
        </div>

        {editor.dirty ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
            <AlertCircle className="size-3.5" />
            有 {editor.drafts.length} 项未提交修改，提交后才会包含在本次构建中。
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-3 text-sm font-semibold">最近一次运行</h2>
        {run ? (
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[var(--ed-text-subtle)]">状态</dt>
              <dd className={cn("flex items-center gap-1.5", statusMeta.className)}>
                <CircleDot className="size-3.5" />
                {statusMeta.text}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--ed-text-subtle)]">开始时间</dt>
              <dd>{new Date(run.created_at).toLocaleString("zh-CN")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--ed-text-subtle)]">链接</dt>
              <dd>
                <a
                  href={run.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--ed-primary)] hover:underline"
                >
                  在 GitHub Actions 查看
                  <ExternalLink className="size-3" />
                </a>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-[var(--ed-text-subtle)]">暂无运行记录。</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-2 text-sm font-semibold">说明</h2>
        <ul className="space-y-1.5 text-xs text-[var(--ed-text-muted)]">
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            内容提交到内容分支后不会自动发布，需要重建。
          </li>
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            构建读取内容分支的最新提交，按 <code>config.js</code> 预渲染全部文档页。
          </li>
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            一次构建通常需要 1–2 分钟。
          </li>
        </ul>
      </section>
    </div>
  );
}

/* ---------------- 工具 ---------------- */

function countDocs(node: DocsNode): number {
  let count = node.index ? 1 : 0;
  for (const child of node.children) {
    count += child.children.length === 0 && !child.index ? 1 : countDocs(child);
  }
  return count;
}

function collectDocs(node: DocsNode): Array<{ path: string; title: string }> {
  const out: Array<{ path: string; title: string }> = [];
  const visit = (current: DocsNode) => {
    if (current.index) out.push({ path: current.index.path, title: current.index.title });
    for (const child of current.children) {
      if (child.children.length === 0 && !child.index) {
        out.push({ path: child.path, title: child.title });
      } else {
        visit(child);
      }
    }
  };
  visit(node);
  return out;
}
