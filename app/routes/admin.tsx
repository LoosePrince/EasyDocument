import { useMemo, useState } from "react";
import { FilePlus2, Settings2, Trash2, ChevronRight } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { SiteHeader } from "~/components/layout/site-header";
import { SignedInBadge, TokenForm, useGitHubAuth } from "~/components/editor/github-auth";
import { ConfigEditor } from "~/components/editor/config-editor";
import { createFile, deleteFile } from "~/lib/editor/operations";
import { contentPath } from "~/lib/content/pointer";
import { docUrlPath } from "~/lib/content/routes";
import { triggerRebuild } from "~/lib/github/rebuild";
import { Loader2 } from "lucide-react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "编辑台" }, { name: "robots", content: "noindex" }];
}

type Tab = "docs" | "config";

/**
 * 网页端编辑台
 *
 * - 文档：新建 / 删除（编辑在文档页内联完成）
 * - 配置：直接编辑 data 分支的 config.js（表单 + 高级 JSON）
 * - 重建：一键触发 deploy 工作流
 */
export default function AdminPage() {
  const { config, branches, pointer } = useSite();
  const auth = useGitHubAuth();
  const [tab, setTab] = useState<Tab>("docs");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newBranch, setNewBranch] = useState(branches[0]?.name ?? pointer.branch);
  const [rebuildState, setRebuildState] = useState<"idle" | "sending" | "sent">("idle");

  const repo = useMemo(
    () => ({ owner: pointer.owner, repo: pointer.repo }),
    [pointer.owner, pointer.repo],
  );

  if (!config.admin.enable) {
    return (
      <div className="min-h-screen">
        {config.layout.show_header ? <SiteHeader /> : null}
        <main className="mx-auto max-w-xl px-5 py-24 text-center">
          <p className="text-sm text-[var(--ed-text-muted)]">
            编辑台已在配置中关闭（admin.enable = false）。
          </p>
        </main>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!auth.client) return;
    const cleanPath = newPath.trim().replace(/^\/+/, "");
    if (!cleanPath) {
      setFeedback("请输入文档路径，例如 使用指南/新文档.md");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const fullPath = contentPath(
        {
          owner: pointer.owner,
          repo: pointer.repo,
          branch: pointer.branch,
          configPath: "config.js",
          rootDir: "",
        },
        `${newBranch}/${cleanPath}`,
      );
      await createFile(auth.client, repo, {
        branch: pointer.branch,
        path: fullPath,
        content: `# ${cleanPath.split("/").pop()?.replace(/\.(md|html)$/i, "") ?? "新文档"}\n\n在这里开始编写内容。\n`,
        message: `docs(${newBranch}): 新建 ${cleanPath}`,
      });
      setFeedback(`已创建 ${fullPath}，请到文档编辑器中完善内容`);
      setNewPath("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (branch: string, path: string) => {
    if (!auth.client) return;
    if (!window.confirm(`确认删除 ${branch}/${path}？`)) return;
    setBusy(true);
    try {
      const fullPath = contentPath(
        {
          owner: pointer.owner,
          repo: pointer.repo,
          branch: pointer.branch,
          configPath: "config.js",
          rootDir: "",
        },
        `${branch}/${path}`,
      );
      await deleteFile(auth.client, repo, {
        branch: pointer.branch,
        path: fullPath,
        message: `docs(${branch}): 删除 ${path}`,
      });
      setFeedback(`已删除 ${fullPath}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  const handleRebuild = async () => {
    if (!auth.client) return;
    setRebuildState("sending");
    try {
      await triggerRebuild(auth.client, repo);
      setRebuildState("sent");
      setFeedback("已触发重建，约 1–2 分钟后站点更新");
    } catch (error) {
      setRebuildState("idle");
      setFeedback(error instanceof Error ? error.message : "触发失败");
    }
  };

  return (
    <div className="min-h-screen">
      {config.layout.show_header ? <SiteHeader /> : null}

      <main className="mx-auto max-w-4xl px-5 py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">编辑台</h1>
            <p className="mt-1 text-xs text-[var(--ed-text-muted)]">
              仓库 {pointer.owner}/{pointer.repo} · 内容分支 {pointer.branch}
            </p>
          </div>
          {auth.token ? (
            <SignedInBadge user={auth.user} token={auth.token} onSignOut={auth.signOut} />
          ) : null}
        </header>

        {!auth.token ? (
          <section className="mx-auto max-w-lg rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5">
            <TokenForm
              onSubmit={async (token, remember) => {
                await auth.signIn(token, remember);
              }}
              loading={auth.loading}
              error={auth.error}
            />
          </section>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-1 rounded-lg border border-[var(--ed-border)] p-1">
              <TabButton active={tab === "docs"} onClick={() => setTab("docs")} icon={<FilePlus2 className="size-4" />}>
                文档
              </TabButton>
              <TabButton active={tab === "config"} onClick={() => setTab("config")} icon={<Settings2 className="size-4" />}>
                站点配置
              </TabButton>
            </div>

            {tab === "docs" ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
                  <h2 className="mb-3 text-sm font-semibold">新建文档</h2>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={newBranch}
                      onChange={(event) => setNewBranch(event.target.value)}
                      className="rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-2.5 py-2 text-sm"
                      aria-label="选择版本"
                    >
                      {branches.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newPath}
                      onChange={(event) => setNewPath(event.target.value)}
                      placeholder="使用指南/新文档.md"
                      className="min-w-48 flex-1 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ed-primary)]"
                      aria-label="文档路径"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreate()}
                      disabled={busy}
                      className="rounded-lg bg-[var(--ed-primary)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      创建
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[var(--ed-text-subtle)]">
                    路径相对于版本目录；支持 .md 与 .html，所在目录会自动出现在侧栏。
                  </p>
                </section>

                <section className="rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
                  <h2 className="mb-3 text-sm font-semibold">文档列表</h2>
                  <div className="max-h-96 space-y-4 overflow-y-auto">
                    {branches.map((branch) => (
                      <div key={branch.name}>
                        <p className="mb-1.5 text-xs font-medium text-[var(--ed-text-muted)]">
                          {branch.label}
                        </p>
                        <ul className="space-y-1">
                          {collectAll(branch.tree).map((doc) => (
                            <li
                              key={doc.path}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--ed-bg-subtle)]"
                            >
                              <Link
                                to={docUrlPath({
                                  branch: branch.name,
                                  path: doc.path.replace(/\.(md|html)$/i, ""),
                                })}
                                className="min-w-0 flex-1 truncate text-[var(--ed-text-muted)] hover:text-[var(--ed-primary)]"
                              >
                                {doc.title}
                                <span className="ml-1.5 font-mono text-[10px] opacity-50">
                                  {doc.path}
                                </span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => void handleDelete(branch.name, doc.path)}
                                className="text-[var(--ed-text-subtle)] hover:text-red-500"
                                aria-label={`删除 ${doc.path}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="flex items-center gap-3 rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">重新构建站点</p>
                    <p className="text-xs text-[var(--ed-text-muted)]">
                      提交内容后需要重建才能生效（触发 deploy.yml）。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRebuild()}
                    disabled={rebuildState === "sending"}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-primary)] px-3 py-2 text-sm font-medium text-[var(--ed-primary)] disabled:opacity-50"
                  >
                    {rebuildState === "sending" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    {rebuildState === "sent" ? "已触发" : "立即重建"}
                  </button>
                </section>
              </div>
            ) : (
              <ConfigEditor client={auth.client} repo={repo} dataBranch={pointer.branch} />
            )}

            {feedback ? (
              <p className="rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-subtle)] px-3 py-2 text-xs text-[var(--ed-text-muted)]">
                {feedback}
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-[var(--ed-primary)] text-white"
          : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function collectAll(node: import("~/lib/content/types").DocsNode): Array<{ path: string; title: string }> {
  const out: Array<{ path: string; title: string }> = [];
  const visit = (current: typeof node) => {
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
