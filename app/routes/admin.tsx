import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FilePlus2,
  FolderTree,
  GripVertical,
  ListTree,
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
import { useI18n } from "~/lib/i18n/provider";
import { TokenForm } from "~/components/editor/github-auth";
import { ConfigEditor } from "~/components/editor/config-editor";
import { EditToolbar } from "~/components/editor/edit-toolbar";
import { ConfirmDialog, SelectMenu } from "~/components/ui/dialog";
import { Icon } from "~/components/ui/icon";
import { IconPicker } from "~/components/ui/icon-picker";
import { assertSafeDocPath } from "~/lib/editor/operations";
import { docUrlPath } from "~/lib/content/routes";
import { toSourcePath } from "~/lib/content/language";
import { stripExtension, type DocsNode } from "~/lib/content/types";
import { serializePathConfig } from "~/lib/content/path-config";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: "控制台" }, { name: "robots", content: "noindex" }];
}

type Tab = "overview" | "docs" | "catalog" | "config" | "deploy";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "总览", icon: <LayoutDashboard className="size-4" /> },
  { id: "docs", label: "文档管理", icon: <FolderTree className="size-4" /> },
  { id: "catalog", label: "目录与排序", icon: <ListTree className="size-4" /> },
  { id: "config", label: "站点配置", icon: <Settings2 className="size-4" /> },
  { id: "deploy", label: "构建部署", icon: <Activity className="size-4" /> },
];

/** 控制台：总览 / 文档管理 / 站点配置 / 构建部署 */
export default function AdminPage() {
  const { config, branches, defaultBranch, pointer } = useSite();
  const { t } = useI18n();
  const editor = useEditorContext();
  const [tab, setTab] = useState<Tab>("overview");

  if (!config.admin.enable) {
    return (
      <div className="min-h-screen">
        {config.layout.show_header ? <SiteHeader /> : null}
        <main className="mx-auto max-w-md px-5 py-24 text-center">
          <ShieldAlert className="mx-auto mb-3 size-8 text-[var(--ed-text-subtle)]" />
          <p className="text-sm text-[var(--ed-text-muted)]">
            {t("控制台已在配置中关闭（admin.enable = false）。")}
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
            <h1 className="text-xl font-semibold">{t("控制台")}</h1>
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
            {editor.editing ? t("退出编辑模式") : t("进入编辑模式")}
          </button>
        </header>

        {!editor.token ? (
          <section className="mx-auto max-w-lg rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5">
            <h2 className="mb-3 text-sm font-semibold">{t("连接 GitHub")}</h2>
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
                  {t(item.label)}
                </button>
              ))}
            </nav>

            <div className="min-w-0">
              {tab === "overview" ? (
                <Overview onNavigate={setTab} />
              ) : tab === "docs" ? (
                <DocManager branches={branches} defaultBranch={defaultBranch} />
              ) : tab === "catalog" ? (
                <CatalogEditor branches={branches} defaultBranch={defaultBranch} />
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
  const { t, documentLanguage } = useI18n();
  const editor = useEditorContext();

  const totalDocs = branches.reduce((sum, branch) => sum + countDocs(branch.tree), 0);

  const stats = [
    { label: t("文档总数"), value: String(totalDocs), icon: <FilePlus2 className="size-4" /> },
    { label: t("版本数"), value: String(branches.length), icon: <FolderTree className="size-4" /> },
    {
      label: t("待提交修改"),
      value: String(editor.drafts.length),
      icon: <GitCommitHorizontal className="size-4" />,
    },
    {
      label: t("编辑入口"),
      value: config.admin.enable ? t("开启") : t("关闭"),
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
        <h2 className="mb-3 text-sm font-semibold">{t("快捷操作")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <QuickAction
            title={t("管理文档")}
            description={t("新建、删除，或回到侧栏就地编辑")}
            onClick={() => onNavigate("docs")}
          />
          <QuickAction
            title={t("修改站点配置")}
            description={t("表单或直接编辑 config.js")}
            onClick={() => onNavigate("config")}
          />
          <QuickAction
            title={t("触发站点重建")}
            description={t("提交内容后让线上生效")}
            onClick={() => onNavigate("deploy")}
          />
          <QuickAction
            title={t("打开默认版本「{name}」", { name: defaultBranch })}
            description={t("回到文档浏览并就地编辑")}
            href={docUrlPath({
              branch: defaultBranch,
              path: "",
              documentLanguage,
            })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-2 text-sm font-semibold">{t("内容来源")}</h2>
        <dl className="grid gap-2 text-xs text-[var(--ed-text-muted)] sm:grid-cols-2">
          <div>
            <dt className="text-[var(--ed-text-subtle)]">{t("仓库")}</dt>
            <dd className="font-mono">
              {pointer.owner || "—"}/{pointer.repo || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ed-text-subtle)]">{t("内容分支配置")}</dt>
            <dd className="font-mono">
              {pointer.branch}:{pointer.configPath}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ed-text-subtle)]">{t("文档根")}</dt>
            <dd className="font-mono">{pointer.rootDir || "(分支根)"}</dd>
          </div>
          <div>
            <dt className="text-[var(--ed-text-subtle)]">{t("已连接账号")}</dt>
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
            {t("在 GitHub 查看内容分支")}
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
  const { t, documentLanguage } = useI18n();
  const editor = useEditorContext();
  const [activeBranch, setActiveBranch] = useState(defaultBranch);
  const [newPath, setNewPath] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const branch = branches.find((item) => item.name === activeBranch) ?? branches[0];
  const tree = useMemo(
    () => (branch ? editor.previewTree(branch.tree, branch.name) : null),
    [branch, editor],
  );
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
        <h2 className="mb-2 text-sm font-semibold">{t("新建文档")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreate();
            }}
            placeholder={t("使用指南/新章节.md")}
            aria-label={t("文档路径")}
            className="min-w-48 flex-1 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--ed-primary)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-sm font-medium text-white"
          >
            {t("加入待提交")}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-[var(--ed-text-subtle)]">
          {t("路径相对于版本目录，支持 {exts}。", {
            exts: config.document.supported_extensions.join(" / "),
          })}
        </p>
        {feedback ? <p className="mt-1.5 text-xs text-[var(--ed-text-muted)]">{feedback}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--ed-border)] bg-[var(--ed-bg-subtle)]/60 text-xs text-[var(--ed-text-muted)]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("文档")}</th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">{t("路径")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("操作")}</th>
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
                        to={docUrlPath({
                          branch: activeBranch,
                          path: stripExtension(doc.path),
                          documentLanguage,
                        })}
                        className="rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-primary)]"
                      >
                        {t("打开")}
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
                  {t("该版本还没有文档。")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-[var(--ed-text-subtle)]">
        {t("删除与新建都会先进入待提交列表，统一在顶部工具条提交。")}
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

/* ---------------- 目录与排序 ---------------- */

type DropPosition = "before" | "after" | "inside";

/**
 * 目录配置编辑（path.json）
 *
 * - 拖动：同层调整顺序；拖到文件夹中间可移入，拖到文件夹外可移出
 * - 点击：每行提供上移 / 下移
 * - 图标：目录与文档都可以从图标库选择或输入链接
 * - 跨文件夹移动会真实移动内容文件（生成新增 + 删除草稿）
 */
function CatalogEditor({
  branches,
  defaultBranch,
}: {
  branches: Array<{ name: string; label: string; tree: DocsNode; docCount: number }>;
  defaultBranch: string;
}) {
  const { config, pointer } = useSite();
  const { t } = useI18n();
  const editor = useEditorContext();
  const [activeBranch, setActiveBranch] = useState(defaultBranch);
  const [json, setJson] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [mount, setMount] = useState({ path: "", mode: "github_tree" as "github_tree" | "path_json", url: "" });
  const [iconTarget, setIconTarget] = useState<DocsNode | null>(null);
  const [pendingMove, setPendingMove] = useState<{ from: DocsNode; target: DocsNode; position: DropPosition } | null>(null);

  const branch = branches.find((item) => item.name === activeBranch) ?? branches[0];
  const configName = config.document.path_config || "path.json";
  const draft = editor.getPathConfig(activeBranch);
  const configPath = `${activeBranch}/${configName}`;

  const tree = useMemo(
    () => (branch ? editor.previewTree(branch.tree, activeBranch) : null),
    [branch, editor, activeBranch],
  );

  // 未编辑时展示「当前树推导出来的配置」
  useEffect(() => {
    if (draft) {
      setJson(draft.content);
      return;
    }
    if (!tree) return;
    setJson(`${JSON.stringify(serializePathConfig(tree), null, 2)}\n`);
  }, [draft, tree]);

  const save = (text: string) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object") throw new Error("必须是 JSON 对象");
      editor.savePathConfig({ path: configPath, branch: activeBranch, content: text });
      setFeedback({ type: "ok", text: t("已保存到本地草稿，提交后生效") });
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        text: t("JSON 语法错误：{message}", {
          message: error instanceof Error ? error.message : String(error),
        }),
      });
      return false;
    }
  };

  const readConfig = (): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 回落到当前树
    }
    return tree ? (serializePathConfig(tree) as Record<string, unknown>) : { children: [] };
  };

  const writeConfig = (next: Record<string, unknown>) => {
    const text = `${JSON.stringify(next, null, 2)}\n`;
    setJson(text);
    save(text);
  };

  const updateNode = (node: DocsNode, patch: { title?: string; icon?: string; hidden?: boolean }) => {
    const next = upsertNode(readConfig(), node, patch);
    writeConfig(next);
  };

  const handleReorder = (fromKey: string, toKey: string, position: DropPosition) => {
    if (!tree || fromKey === toKey) return;
    const fromNode = findNodeByKey(tree, fromKey);
    const targetNode = findNodeByKey(tree, toKey);
    if (!fromNode || !targetNode) return;

    const sourceParent = parentDir(fromKey);
    const targetParent = position === "inside" ? toKey : parentDir(toKey);

    // 不能把目录移入自己或自己的子目录
    if (toKey === fromKey || toKey.startsWith(`${fromKey}/`)) {
      setFeedback({ type: "error", text: t("不能把目录移动到自身内部") });
      return;
    }

    if (position !== "inside" && sourceParent === targetParent) {
      const siblings = getSiblings(tree, sourceParent);
      const ordered = moveWithinSiblings(siblings, fromKey, toKey, position);
      writeConfig(orderChildEntries(readConfig(), sourceParent, ordered));
      return;
    }

    setPendingMove({ from: fromNode, target: targetNode, position });
  };

  const performMove = async () => {
    if (!pendingMove || !editor.client || !tree) return;
    const { from, position } = pendingMove;
    const target = pendingMove.target;
    setPendingMove(null);

    const sourceKey = nodeKey(from);
    const targetParent = position === "inside" ? nodeKey(target) : parentDir(nodeKey(target));
    const targetKey = [targetParent, sourceKey.split("/").pop()].filter(Boolean).join("/");

    const files = collectFiles(from);
    const language = config.i18n.default_language;
    let moved = 0;

    for (const file of files) {
      if (file.external) continue;
      const relative = file.logical.slice(sourceKey.length).replace(/^\/+/, "");
      const nextLogical = [targetKey, relative].filter(Boolean).join("/");
      // 保留语言文件夹前缀（如 zh/），避免把默认语言文档移出语言目录
      const nextSource = file.source.includes(sourceKey)
        ? file.source.replace(sourceKey, targetKey)
        : toSourcePath(nextLogical, language, config.i18n);
      const remote = await editor.client.getFile(editor.repo, file.source, pointer.branch);
      if (!remote) continue;
      editor.saveDraft({
        path: nextLogical,
        sourcePath: nextSource,
        branch: activeBranch,
        kind: "create",
        content: remote.content,
        title: file.title,
        format: nextLogical.endsWith(".html") ? "html" : "md",
      });
      editor.saveDraft({
        path: file.logical,
        sourcePath: file.source,
        branch: activeBranch,
        kind: "delete",
        title: file.title,
      });
      moved += 1;
    }

    if (moved === 0) {
      setFeedback({ type: "error", text: t("没有可移动的文件（外部文档不会移动）") });
      return;
    }

    const next = moveEntry(
      readConfig(),
      sourceKey,
      targetKey,
      targetParent,
      position === "inside" ? undefined : nodeKey(target),
      position,
    );
    writeConfig(next);
    setFeedback({
      type: "ok",
      text: t("已移动 {count} 个文件到「{target}」，提交后生效", { count: moved, target: target.title }),
    });
  };

  if (!branch || !tree) {
    return <p className="text-sm text-[var(--ed-text-muted)]">{t("该版本不存在。")}</p>;
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
          </button>
        ))}
        <code className="ml-auto text-[11px] text-[var(--ed-text-subtle)]">{configPath}</code>
      </div>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-1 text-sm font-semibold">{t("目录树")}</h2>
        <p className="mb-3 text-xs text-[var(--ed-text-muted)]">
          {t("显示名、顺序与隐藏都写进 {file}，不改变物理文件名。", { file: configName })}
          {" "}
          {t("拖动可排序，拖到文件夹中间可移入；也可以点击上移 / 下移。")}
        </p>
        <CatalogList
          nodes={tree.children}
          depth={0}
          onRename={(node, title) => updateNode(node, { title })}
          onHide={(node) => updateNode(node, { hidden: !node.hidden })}
          onSetIcon={setIconTarget}
          onReorder={handleReorder}
        />
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-2 text-sm font-semibold">{t("外部文档挂载")}</h2>
        <p className="mb-3 text-xs text-[var(--ed-text-muted)]">
          {t("支持 GitHub 目录链接或任意公开目录；构建期拉取一次并预渲染，前端也会实时刷新。")}
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_170px_2fr_auto]">
          <input
            value={mount.path}
            onChange={(event) => setMount({ ...mount, path: event.target.value })}
            placeholder={t("挂载目录，如 外部文档")}
            aria-label={t("挂载目录")}
            className="rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--ed-primary)]"
          />
          <SelectMenu
            value={mount.mode}
            options={[
              { value: "github_tree", label: t("GitHub 目录") },
              { value: "path_json", label: t("path.json / 公开目录") },
            ]}
            onChange={(value) => setMount({ ...mount, mode: value as typeof mount.mode })}
            ariaLabel={t("挂载方式")}
          />
          <input
            value={mount.url}
            onChange={(event) => setMount({ ...mount, url: event.target.value })}
            placeholder="https://github.com/owner/repo/tree/main/docs"
            aria-label={t("挂载地址")}
            className="rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--ed-primary)]"
          />
          <button
            type="button"
            onClick={() => {
              if (!mount.path || !mount.url) {
                setFeedback({ type: "error", text: t("挂载目录与地址都不能为空") });
                return;
              }
              writeConfig(addMount(readConfig(), mount));
              setMount({ path: "", mode: "github_tree", url: "" });
            }}
            className="rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-sm font-medium text-white"
          >
            {t("添加挂载")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("高级：直接编辑 {file}", { file: configName })}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setJson(`${JSON.stringify(serializePathConfig(tree), null, 2)}\n`)}
              className="text-xs text-[var(--ed-text-muted)] hover:text-[var(--ed-primary)]"
            >
              {t("从当前树重建")}
            </button>
            {draft ? (
              <button
                type="button"
                onClick={() => {
                  editor.removePathConfig(activeBranch);
                  setFeedback({ type: "ok", text: t("已放弃该版本的目录配置修改") });
                }}
                className="text-xs text-[var(--ed-text-muted)] hover:text-red-500"
              >
                {t("放弃修改")}
              </button>
            ) : null}
          </div>
        </div>
        <textarea
          value={json}
          onChange={(event) => setJson(event.target.value)}
          spellCheck={false}
          aria-label={t("目录配置源码")}
          className="h-64 w-full resize-y rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-[var(--ed-primary)]"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save(json)}
            className="rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white"
          >
            {t("保存到草稿")}
          </button>
          {feedback ? (
            <span
              className={cn(
                "text-xs",
                feedback.type === "ok" ? "text-emerald-500" : "text-red-500",
              )}
            >
              {feedback.text}
            </span>
          ) : null}
        </div>
      </section>

      <IconPicker
        open={iconTarget !== null}
        value={iconTarget ? (iconTarget.icon ?? iconTarget.index?.icon ?? "") : ""}
        title={iconTarget ? t("设置图标") : undefined}
        onClose={() => setIconTarget(null)}
        onSelect={(value) => {
          if (iconTarget) updateNode(iconTarget, { icon: value });
          setIconTarget(null);
        }}
      />

      <ConfirmDialog
        open={pendingMove !== null}
        title={t("确认移动")}
        message={
          pendingMove
            ? t("将把「{name}」移动到「{target}」，这会真实移动内容文件并加入待提交列表。", {
                name: pendingMove.from.title,
                target:
                  pendingMove.position === "inside"
                    ? pendingMove.target.title
                    : t("目标目录"),
              })
            : ""
        }
        confirmText={t("移动")}
        cancelText={t("取消")}
        onConfirm={() => void performMove()}
        onCancel={() => setPendingMove(null)}
      />
    </div>
  );
}

function CatalogList({
  nodes,
  depth,
  onRename,
  onHide,
  onSetIcon,
  onReorder,
}: {
  nodes: DocsNode[];
  depth: number;
  onRename: (node: DocsNode, title: string) => void;
  onHide: (node: DocsNode) => void;
  onSetIcon: (node: DocsNode) => void;
  onReorder: (fromPath: string, toPath: string, position: DropPosition) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node, index) => (
        <CatalogRow
          key={nodeKey(node)}
          node={node}
          depth={depth}
          index={index}
          total={nodes.length}
          previous={nodes[index - 1]}
          next={nodes[index + 1]}
          onRename={onRename}
          onHide={onHide}
          onSetIcon={onSetIcon}
          onReorder={onReorder}
        />
      ))}
    </ul>
  );
}

function CatalogRow({
  node,
  depth,
  index,
  total,
  previous,
  next,
  onRename,
  onHide,
  onSetIcon,
  onReorder,
}: {
  node: DocsNode;
  depth: number;
  index: number;
  total: number;
  previous?: DocsNode;
  next?: DocsNode;
  onRename: (node: DocsNode, title: string) => void;
  onHide: (node: DocsNode) => void;
  onSetIcon: (node: DocsNode) => void;
  onReorder: (fromPath: string, toPath: string, position: DropPosition) => void;
}) {
  const { t } = useI18n();
  const isFile = node.children.length === 0 && !node.index && !node.mount;
  const [drop, setDrop] = useState<DropPosition | null>(null);
  const key = nodeKey(node);
  const icon = node.icon ?? node.index?.icon;

  return (
    <li>
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", key);
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("text/plain")) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - rect.top) / rect.height;
          if (!isFile && ratio > 0.28 && ratio < 0.72) setDrop("inside");
          else setDrop(ratio < 0.5 ? "before" : "after");
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(event) => {
          event.preventDefault();
          const from = event.dataTransfer.getData("text/plain");
          const position = drop ?? "before";
          setDrop(null);
          if (from && from !== key) onReorder(from, key, position);
        }}
        onDragEnd={() => setDrop(null)}
        className={cn(
          "relative flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--ed-bg-subtle)]",
          drop === "inside" && "bg-[var(--ed-primary-soft)] ring-1 ring-[var(--ed-primary)]",
          drop === "before" &&
            "before:absolute before:left-2 before:right-2 before:top-0 before:h-0.5 before:bg-[var(--ed-primary)]",
          drop === "after" &&
            "after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-[var(--ed-primary)]",
        )}
        style={{ marginLeft: `${depth * 0.75}rem` }}
      >
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-[var(--ed-text-subtle)]" aria-hidden="true" />

        <button
          type="button"
          onClick={() => onSetIcon(node)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg)] hover:text-[var(--ed-primary)]"
          title={t("设置图标")}
          aria-label={t("设置图标")}
        >
          {icon ? (
            <Icon name={icon} className="size-4" />
          ) : isFile ? (
            <FilePlus2 className="size-3.5 opacity-50" />
          ) : (
            <FolderTree className="size-3.5 opacity-50" />
          )}
        </button>

        <input
          defaultValue={node.title}
          key={`${key}-${node.title}`}
          onBlur={(event) => {
            const title = event.target.value.trim();
            if (title && title !== node.title) onRename(node, title);
          }}
          aria-label={t("显示名：{title}", { title: node.title })}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none hover:border-[var(--ed-border)] focus:border-[var(--ed-primary)]"
        />

        <span className="shrink-0 font-mono text-[10px] text-[var(--ed-text-subtle)]">{key}</span>

        {node.mount ? (
          <span className="shrink-0 rounded bg-[var(--ed-primary-soft)] px-1.5 py-0.5 text-[10px] text-[var(--ed-primary)]">
            {t("外部挂载")}
          </span>
        ) : null}
        {node.hidden ? (
          <span className="shrink-0 rounded bg-[var(--ed-bg-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--ed-text-subtle)]">
            {t("隐藏")}
          </span>
        ) : null}

        <button
          type="button"
          disabled={index === 0}
          onClick={() => previous && onReorder(key, nodeKey(previous), "before")}
          className="grid size-6 shrink-0 place-items-center rounded text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg)] hover:text-[var(--ed-primary)] disabled:opacity-30"
          title={t("上移")}
          aria-label={t("上移")}
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => next && onReorder(key, nodeKey(next), "after")}
          className="grid size-6 shrink-0 place-items-center rounded text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg)] hover:text-[var(--ed-primary)] disabled:opacity-30"
          title={t("下移")}
          aria-label={t("下移")}
        >
          <ArrowDown className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onHide(node)}
          className="shrink-0 text-[11px] text-[var(--ed-text-subtle)] hover:text-red-500"
        >
          {node.hidden ? t("显示") : t("隐藏")}
        </button>
      </div>

      {node.children.length > 0 ? (
        <CatalogList
          nodes={node.children}
          depth={depth + 1}
          onRename={onRename}
          onHide={onHide}
          onSetIcon={onSetIcon}
          onReorder={onReorder}
        />
      ) : null}
    </li>
  );
}

/* ---- path.json 小工具 ---- */

function nodeKey(node: DocsNode): string {
  // 目录用目录路径，文件用文件路径；index.path 只用于读取文档内容
  return node.path || node.index?.path || "";
}

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function findNodeByKey(tree: DocsNode, key: string): DocsNode | null {
  let found: DocsNode | null = null;
  const visit = (node: DocsNode) => {
    if (found) return;
    if (nodeKey(node) === key) {
      found = node;
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(tree);
  return found;
}

function getSiblings(tree: DocsNode, parentPath: string): DocsNode[] {
  if (!parentPath) return tree.children;
  const parent = findNodeByKey(tree, parentPath);
  return parent?.children ?? [];
}

/** 同层移动：把 from 移到 to 的前/后 */
function moveWithinSiblings(
  siblings: DocsNode[],
  fromKey: string,
  toKey: string,
  position: "before" | "after",
): DocsNode[] {
  const fromIndex = siblings.findIndex((node) => nodeKey(node) === fromKey);
  if (fromIndex === -1) return siblings;
  const list = [...siblings];
  const [moved] = list.splice(fromIndex, 1);
  const targetIndex = list.findIndex((node) => nodeKey(node) === toKey);
  if (targetIndex === -1) return siblings;
  list.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, moved);
  return list;
}

/** 取得某目录在 path.json 中的 children 数组 */
function ensureChildList(
  root: Record<string, unknown>,
  dirPath: string,
): Array<Record<string, unknown>> {
  if (!Array.isArray(root.children)) root.children = [];
  let list = root.children as Array<Record<string, unknown>>;
  if (!dirPath) return list;

  for (const segment of dirPath.split("/").filter(Boolean)) {
    let node = list.find(
      (item) =>
        item.path === segment ||
        item.path === `${segment}/README.md` ||
        item.path === `${segment}/README`,
    );
    if (!node) {
      node = { path: segment, children: [] };
      list.push(node);
    }
    if (!Array.isArray(node.children)) node.children = [];
    list = node.children as Array<Record<string, unknown>>;
  }
  return list;
}

function findEntry(
  root: Record<string, unknown>,
  key: string,
): { list: Array<Record<string, unknown>>; index: number; entry: Record<string, unknown> } | null {
  const list = Array.isArray(root.children) ? (root.children as Array<Record<string, unknown>>) : [];
  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index];
    if (entry.path === key) return { list, index, entry };
    if (entry.index && typeof entry.index === "object") {
      const indexPath = (entry.index as Record<string, unknown>).path;
      if (indexPath === key) return { list, index, entry };
    }
    const nested = findEntry(entry, key);
    if (nested) return nested;
  }
  return null;
}

function upsertNode(
  root: Record<string, unknown>,
  node: DocsNode,
  patch: { title?: string; icon?: string; hidden?: boolean },
): Record<string, unknown> {
  const key = node.path || node.index?.path || "";
  const found = findEntry(root, key) ?? (node.index?.path ? findEntry(root, node.index.path) : null);
  if (found) {
    if (patch.title !== undefined) found.entry.title = patch.title;
    if (patch.icon !== undefined) {
      if (patch.icon) found.entry.icon = patch.icon;
      else delete found.entry.icon;
    }
    if (patch.hidden !== undefined) {
      if (patch.hidden) found.entry.hidden = true;
      else delete found.entry.hidden;
    }
    return root;
  }

  const list = ensureChildList(root, parentDir(key));
  const entry: Record<string, unknown> = { path: key };
  if (patch.title !== undefined) entry.title = patch.title;
  if (patch.icon) entry.icon = patch.icon;
  if (patch.hidden) entry.hidden = true;
  list.push(entry);
  return root;
}

/** 按顺序重排某个目录的 children（保留条目上的 title/icon 等） */
function orderChildEntries(
  root: Record<string, unknown>,
  parentPath: string,
  orderedNodes: DocsNode[],
): Record<string, unknown> {
  const list = ensureChildList(root, parentPath);
  const byKey = new Map<string, Record<string, unknown>>();
  for (const entry of list) {
    if (typeof entry.path === "string") byKey.set(entry.path, entry);
    if (entry.index && typeof entry.index === "object") {
      const indexPath = (entry.index as Record<string, unknown>).path;
      if (typeof indexPath === "string") byKey.set(indexPath, entry);
    }
  }

  const ordered: Array<Record<string, unknown>> = [];
  const used = new Set<Record<string, unknown>>();
  for (const node of orderedNodes) {
    const entry = byKey.get(node.path) ?? (node.index ? byKey.get(node.index.path) : undefined);
    if (entry && !used.has(entry)) {
      ordered.push(entry);
      used.add(entry);
    }
  }
  const remainder = list.filter((entry) => !used.has(entry));
  list.splice(0, list.length, ...ordered, ...remainder);
  return root;
}

/** 从 path.json 中移除并移动到新父级；路径与子项前缀一起改写 */
function moveEntry(
  root: Record<string, unknown>,
  fromKey: string,
  toKey: string,
  targetParent: string,
  anchorKey?: string,
  position: "before" | "after" | "inside" = "inside",
): Record<string, unknown> {
  const found = findEntry(root, fromKey);
  let entry: Record<string, unknown>;
  if (found) {
    entry = found.list.splice(found.index, 1)[0];
  } else {
    entry = { path: fromKey };
  }
  rebaseEntry(entry, fromKey, toKey);
  const list = ensureChildList(root, targetParent);

  if (anchorKey && position !== "inside") {
    const anchorIndex = list.findIndex(
      (item) =>
        item.path === anchorKey ||
        (item.index &&
          typeof item.index === "object" &&
          (item.index as Record<string, unknown>).path === anchorKey),
    );
    if (anchorIndex !== -1) {
      list.splice(position === "after" ? anchorIndex + 1 : anchorIndex, 0, entry);
      return root;
    }
  }

  list.push(entry);
  return root;
}

function rebaseEntry(entry: Record<string, unknown>, fromKey: string, toKey: string): void {
  const replace = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    if (value === fromKey) return toKey;
    if (value.startsWith(`${fromKey}/`)) return `${toKey}${value.slice(fromKey.length)}`;
    return value;
  };
  entry.path = replace(entry.path);
  if (entry.index && typeof entry.index === "object") {
    const indexEntry = entry.index as Record<string, unknown>;
    indexEntry.path = replace(indexEntry.path);
  }
  if (Array.isArray(entry.children)) {
    for (const child of entry.children) {
      if (child && typeof child === "object") {
        rebaseEntry(child as Record<string, unknown>, fromKey, toKey);
      }
    }
  }
}

/** 收集一个目录节点下的全部文件（含索引页） */
function collectFiles(node: DocsNode): Array<{
  logical: string;
  source: string;
  title: string;
  external?: boolean;
}> {
  const out: Array<{ logical: string; source: string; title: string; external?: boolean }> = [];
  if (node.index) {
    out.push({
      logical: node.index.path,
      source: node.index.sourcePath ?? node.index.path,
      title: node.index.title,
      external: Boolean(node.externalUrl),
    });
  }
  if (node.children.length === 0 && !node.index) {
    out.push({
      logical: node.path,
      source: node.sourcePath ?? node.path,
      title: node.title,
      external: Boolean(node.externalUrl),
    });
  }
  for (const child of node.children) out.push(...collectFiles(child));
  return out;
}

/** 追加外部挂载 */
function addMount(
  root: Record<string, unknown>,
  mount: { path: string; mode: "github_tree" | "path_json"; url: string },
): Record<string, unknown> {
  const list = ensureChildList(root, "");
  const entry = list.find((item) => item.path === mount.path);
  if (entry) {
    entry.external = { mode: mount.mode, url: mount.url };
  } else {
    list.push({ path: mount.path, external: { mode: mount.mode, url: mount.url } });
  }
  return root;
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
  const { t } = useI18n();
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
      ? { text: t("成功"), className: "text-emerald-500" }
      : run?.status === "in_progress" || run?.status === "queued"
        ? { text: t("进行中"), className: "text-amber-500" }
        : run
          ? { text: run.conclusion ?? run.status, className: "text-[var(--ed-text-muted)]" }
          : { text: t("未知"), className: "text-[var(--ed-text-subtle)]" };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t("站点重建")}</h2>
            <p className="mt-0.5 text-xs text-[var(--ed-text-muted)]">
              {t("触发 {file}，用内容分支当前状态重新预渲染并发布。", { file: "deploy.yml" })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1.5 text-xs text-[var(--ed-text-muted)]"
            >
              {polling ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {t("刷新状态")}
            </button>
            <button
              type="button"
              onClick={() => void trigger()}
              disabled={editor.rebuilding || editor.dirty}
              title={editor.dirty ? t("请先提交未保存的修改") : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {editor.rebuilding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t("立即重建")}
            </button>
          </div>
        </div>

        {editor.dirty ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
            <AlertCircle className="size-3.5" />
            {t("有 {count} 项未提交修改，提交后才会包含在本次构建中。", {
              count: editor.drafts.length,
            })}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("最近一次运行")}</h2>
        {run ? (
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[var(--ed-text-subtle)]">{t("状态")}</dt>
              <dd className={cn("flex items-center gap-1.5", statusMeta.className)}>
                <CircleDot className="size-3.5" />
                {statusMeta.text}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--ed-text-subtle)]">{t("开始时间")}</dt>
              <dd>{new Date(run.created_at).toLocaleString("zh-CN")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--ed-text-subtle)]">{t("链接")}</dt>
              <dd>
                <a
                  href={run.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--ed-primary)] hover:underline"
                >
                  {t("在 GitHub Actions 查看")}
                  <ExternalLink className="size-3" />
                </a>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-[var(--ed-text-subtle)]">{t("暂无运行记录。")}</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-4">
        <h2 className="mb-2 text-sm font-semibold">{t("说明")}</h2>
        <ul className="space-y-1.5 text-xs text-[var(--ed-text-muted)]">
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            {t("内容提交到内容分支后不会自动发布，需要重建。")}
          </li>
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            {t("构建读取内容分支的最新提交，按 {file} 预渲染全部文档页。", { file: "config.js" })}
          </li>
          <li className="flex gap-1.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            {t("一次构建通常需要 1–2 分钟。")}
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
