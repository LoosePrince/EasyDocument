import { useState } from "react";
import { AlertCircle, Check, Cloud, CloudOff, GitCommitHorizontal, Loader2, LogOut, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEditorContext } from "~/lib/editor/editor-store";
import { TokenForm } from "./github-auth";
import { cn } from "~/lib/utils";

/**
 * 编辑工具条（全局草稿面板）
 *
 * 当处于编辑模式时显示在顶栏下方：登录入口、待提交清单、提交与重建。
 * 侧栏/正文的修改都会进入同一份草稿，这里统一收口。
 */
export function EditToolbar() {
  const editor = useEditorContext();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (!editor.editing) return null;

  const drafts = editor.drafts;
  const counts = {
    create: drafts.filter((draft) => draft.kind === "create").length,
    update: drafts.filter((draft) => draft.kind === "update").length,
    delete: drafts.filter((draft) => draft.kind === "delete").length,
  };

  const submit = async () => {
    setFeedback(null);
    try {
      const result = await editor.commit(message.trim() || "docs: 网页端编辑");
      setFeedback({ type: "ok", text: `已提交 ${result.committed} 个文件` });
      setMessage("");
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "提交失败",
      });
    }
  };

  return (
    <div className="sticky top-0 z-[58] border-b border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ed-primary)]">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--ed-primary)]" />
          编辑模式
        </span>

        {/* 草稿计数 */}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
            drafts.length > 0
              ? "border-[var(--ed-primary)] text-[var(--ed-primary)]"
              : "border-[var(--ed-border)] text-[var(--ed-text-muted)]",
          )}
        >
          <GitCommitHorizontal className="size-3.5" />
          {drafts.length === 0 ? "无待提交修改" : `${drafts.length} 项待提交`}
          {counts.create ? <Count label="新增" value={counts.create} tone="emerald" /> : null}
          {counts.update ? <Count label="修改" value={counts.update} tone="amber" /> : null}
          {counts.delete ? <Count label="删除" value={counts.delete} tone="red" /> : null}
        </button>

        {drafts.length > 0 ? (
          <button
            type="button"
            onClick={editor.discardAll}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
          >
            <RotateCcw className="size-3.5" />
            全部放弃
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
              className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-2.5 py-1 text-xs font-medium text-white"
            >
              <CloudOff className="size-3.5" />
              连接 GitHub
            </button>
          )}

          <button
            type="button"
            onClick={() => void editor.rebuild()}
            disabled={editor.rebuilding || !editor.token}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-2.5 py-1 text-xs text-[var(--ed-text-muted)] disabled:opacity-40"
            title="触发 GitHub Actions 重新构建站点"
          >
            {editor.rebuilding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            重建站点
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={editor.submitting || drafts.length === 0 || !editor.token}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {editor.submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Cloud className="size-3.5" />
            )}
            提交
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

      {/* 展开：提交信息 + 清单 */}
      {expanded ? (
        <div className="mx-auto max-w-[1600px] space-y-2 border-t border-[var(--ed-border)] px-4 py-3">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="提交信息（可选）"
            aria-label="提交信息"
            className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-1.5 text-xs outline-none focus:border-[var(--ed-primary)]"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {drafts.map((draft) => (
              <li
                key={draft.path}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-[var(--ed-bg-subtle)]"
              >
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px]",
                    draft.kind === "create" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    draft.kind === "update" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    draft.kind === "delete" && "bg-red-500/15 text-red-500",
                  )}
                >
                  {{ create: "新增", update: "修改", delete: "删除" }[draft.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--ed-text-muted)]">
                  {draft.path}
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
            修改会提交到内容分支；提交后需点击「重建站点」才会在线上生效。
          </p>
        </div>
      ) : null}

      {feedback ? (
        <p
          className={cn(
            "mx-auto flex max-w-[1600px] items-center gap-1.5 px-4 pb-2 text-xs",
            feedback.type === "ok" ? "text-emerald-500" : "text-red-500",
          )}
        >
          {feedback.type === "ok" ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}
          {feedback.text}
        </p>
      ) : null}

      {showLogin ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowLogin(false)}
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
                onClick={() => setShowLogin(false)}
                className="grid size-7 place-items-center rounded-md text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <TokenForm
              onSubmit={async (token, remember) => {
                await editor.signIn(token, remember);
                setShowLogin(false);
              }}
              loading={editor.authLoading}
              error={editor.authError}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "red" }) {
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
