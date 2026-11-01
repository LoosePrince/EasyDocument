import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  GitCommitHorizontal,
  Loader2,
  LogOut,
  RotateCcw,
  X,
} from "lucide-react";
import { useEditorContext } from "~/lib/editor/editor-store";
import { TokenForm } from "./github-auth";
import { cn } from "~/lib/utils";

/**
 * 提交栏（编辑模式下常驻顶栏下方）
 *
 * - 显示本地草稿统计（新增 / 修改 / 删除）
 * - 悬停/点击展开待提交清单
 * - 「一键提交」把所有草稿推送到内容分支（需要 PAT）
 * - 构建不在此触发：提交后到控制台「构建部署」手动触发
 */
export function EditToolbar() {
  const editor = useEditorContext();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [message, setMessage] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const drafts = editor.drafts;

  if (!editor.editing) return null;

  const expanded = pinned || hovered;
  const counts = {
    create: drafts.filter((draft) => draft.kind === "create").length,
    update: drafts.filter((draft) => draft.kind === "update").length,
    delete: drafts.filter((draft) => draft.kind === "delete").length,
  };

  const submit = async () => {
    if (!editor.token) {
      setShowLogin(true);
      return;
    }
    setFeedback(null);
    try {
      const result = await editor.commit(message.trim() || "docs: 网页端编辑");
      setFeedback({
        type: "ok",
        text: `已提交 ${result.committed} 个文件到内容分支；到控制台「构建部署」触发重建后生效。`,
      });
      setMessage("");
      setPinned(false);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "提交失败",
      });
    }
  };

  return (
    <div
      className="sticky top-0 z-[58] border-b border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]/95 backdrop-blur"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ed-primary)]">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--ed-primary)]" />
          编辑模式
        </span>

        {/* 草稿统计（悬停展开清单） */}
        <button
          type="button"
          onClick={() => setPinned((value) => !value)}
          aria-expanded={expanded}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
            drafts.length > 0
              ? "border-[var(--ed-primary)] text-[var(--ed-primary)]"
              : "border-[var(--ed-border)] text-[var(--ed-text-muted)]",
          )}
        >
          <GitCommitHorizontal className="size-3.5" />
          {drafts.length === 0 ? "本地无草稿" : `${drafts.length} 项本地草稿`}
          {counts.create ? <Count label="新增" value={counts.create} tone="emerald" /> : null}
          {counts.update ? <Count label="修改" value={counts.update} tone="amber" /> : null}
          {counts.delete ? <Count label="删除" value={counts.delete} tone="red" /> : null}
          <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
        </button>

        {drafts.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`确认放弃全部 ${drafts.length} 项本地草稿？此操作不可撤销。`)) return;
              editor.discardAll();
              setFeedback({ type: "ok", text: "已放弃全部本地草稿" });
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
          >
            <RotateCcw className="size-3.5" />
            放弃全部
          </button>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editor.token ? (
            <>
              <span className="hidden items-center gap-1.5 text-xs text-[var(--ed-text-muted)] sm:flex">
                {editor.user?.avatar_url ? (
                  <img src={editor.user.avatar_url} alt="" className="size-5 rounded-full" />
                ) : null}
                {editor.user?.login ?? "已连接"}
              </span>
              <button
                type="button"
                onClick={editor.signOut}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
              >
                <LogOut className="size-3.5" />
                断开
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1 text-xs text-[var(--ed-text-muted)]"
            >
              <CloudOff className="size-3.5" />
              未连接 GitHub
            </button>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={editor.submitting || drafts.length === 0}
            title={!editor.token ? "提交需要先连接 GitHub" : "把所有本地草稿推送到内容分支"}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {editor.submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Cloud className="size-3.5" />
            )}
            一键提交{drafts.length > 0 ? `（${drafts.length}）` : ""}
          </button>

          <button
            type="button"
            onClick={() => editor.setEditing(false)}
            className="grid size-7 place-items-center rounded-md text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
            aria-label="退出编辑模式"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* 悬停展开：提交信息 + 草稿清单 */}
      {expanded ? (
        <div className="mx-auto max-w-[1600px] space-y-2 border-t border-[var(--ed-border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="提交信息（可选，默认「docs: 网页端编辑」）"
              aria-label="提交信息"
              className="min-w-48 flex-1 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-1.5 text-xs outline-none focus:border-[var(--ed-primary)]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={editor.submitting || drafts.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {editor.submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Cloud className="size-3.5" />
              )}
              提交到内容分支
            </button>
          </div>

          {drafts.length > 0 ? (
            <>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {drafts.map((draft) => (
                  <li
                    key={draft.path}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-[var(--ed-bg-subtle)]"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0.5 text-[10px]",
                        draft.kind === "create" &&
                          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        draft.kind === "update" &&
                          "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        draft.kind === "delete" && "bg-red-500/15 text-red-500",
                      )}
                    >
                      {{ create: "新增", update: "修改", delete: "删除" }[draft.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--ed-text-muted)]">
                      {draft.path}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--ed-text-subtle)]">
                      {new Date(draft.savedAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => editor.removeDraft(draft.path)}
                      className="text-[var(--ed-text-subtle)] hover:text-red-500"
                      aria-label={`放弃 ${draft.path}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--ed-text-subtle)]">
                草稿保存在本浏览器，刷新或切换页面都不会丢失。提交后需到控制台「构建部署」手动触发重建。
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[var(--ed-text-subtle)]">
              还没有本地草稿。在文档页编辑后点「保存修改」，或在此新建文档。
            </p>
          )}
        </div>
      ) : null}

      {feedback ? (
        <p
          className={cn(
            "mx-auto flex max-w-[1600px] items-center gap-1.5 px-4 pb-2 text-xs",
            feedback.type === "ok" ? "text-emerald-500" : "text-red-500",
          )}
        >
          {feedback.type === "ok" ? (
            <Check className="size-3.5" />
          ) : (
            <AlertCircle className="size-3.5" />
          )}
          {feedback.text}
        </p>
      ) : null}

      <LoginDialog
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSubmit={async (token, remember) => {
          await editor.signIn(token, remember);
          setShowLogin(false);
        }}
        loading={editor.authLoading}
        error={editor.authError}
      />
    </div>
  );
}

function LoginDialog({
  open,
  onClose,
  onSubmit,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (token: string, remember: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="连接 GitHub"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">连接 GitHub</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <TokenForm onSubmit={onSubmit} loading={loading} error={error} />
      </div>
    </div>
  );
}

function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red";
}) {
  const toneClass = {
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/15 text-red-500",
  }[tone];

  return (
    <span className={cn("rounded px-1 py-0.5 text-[10px]", toneClass)}>
      {label} {value}
    </span>
  );
}

/**
 * 草稿指示器（常驻全站）
 *
 * 不在编辑模式但存在本地草稿时，显示一个悬浮入口，
 * 避免「保存了却找不到草稿」。
 */
export function DraftIndicator() {
  const editor = useEditorContext();
  if (editor.editing || editor.drafts.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => editor.setEditing(true)}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-[var(--ed-primary)] bg-[var(--ed-bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--ed-primary)] shadow-lg transition-transform hover:-translate-y-0.5"
      title="点击进入编辑模式查看与提交"
    >
      <GitCommitHorizontal className="size-3.5" />
      {editor.drafts.length} 项本地草稿未提交
    </button>
  );
}
