import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { SignedInBadge, TokenForm, useGitHubAuth } from "./github-auth";
import { contentPath } from "~/lib/content/pointer";
import type { RepoRef } from "~/lib/github/client";
import { triggerRebuild } from "~/lib/github/rebuild";

export interface EditorPanelProps {
  branch: string;
  docPath: string;
  /** 保留字段：面板自身会从 GitHub 拉取原文 */
  initialContent?: string;
  onClose: () => void;
  /** 新建模式下使用：预填路径 */
  mode?: "edit" | "create";
}

/**
 * 文档编辑抽屉
 *
 * 流程：填写 PAT → 从 data 分支拉取原文（含 sha）→ 编辑 → 提交（带 sha 防覆盖）
 * 提交后可选「立即重建站点」。
 */
export function EditorPanel({ branch, docPath, onClose, mode = "edit" }: EditorPanelProps) {
  const { config, pointer } = useSite();
  const auth = useGitHubAuth();
  const [content, setContent] = useState("");
  const [sha, setSha] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(`docs(${branch}): 更新 ${docPath}`);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const repo = useMemo<RepoRef>(
    () => ({ owner: pointer.owner, repo: pointer.repo }),
    [pointer.owner, pointer.repo],
  );

  const fullPath = contentPath(
    {
      owner: pointer.owner,
      repo: pointer.repo,
      branch: pointer.branch,
      configPath: "config.js",
      rootDir: "",
    },
    `${branch}/${docPath}`,
  );

  const loadFile = useCallback(async () => {
    if (!auth.client) return;
    setLoading(true);
    setFeedback(null);
    try {
      const file = await auth.client.getFile(repo, fullPath, pointer.branch);
      if (file) {
        setContent(file.content);
        setSha(file.sha);
      } else {
        setFeedback({ type: "error", text: `未找到文件：${fullPath}` });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "读取失败",
      });
    } finally {
      setLoading(false);
    }
  }, [auth.client, fullPath, pointer.branch, repo]);

  useEffect(() => {
    if (auth.client && mode === "edit") void loadFile();
  }, [auth.client, mode, loadFile]);

  const save = async () => {
    if (!auth.client) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await auth.client.putFile(repo, {
        path: fullPath,
        branch: pointer.branch,
        content,
        message,
        sha,
      });
      setSha(result.content.sha);
      setFeedback({ type: "ok", text: "已提交到 data 分支" });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "提交失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!auth.client || !sha) return;
    if (!window.confirm(`确认删除 ${docPath}？此操作会直接提交到 ${pointer.branch} 分支。`)) return;
    setSaving(true);
    try {
      await auth.client.deleteFile(repo, {
        path: fullPath,
        branch: pointer.branch,
        message: `docs(${branch}): 删除 ${docPath}`,
        sha,
      });
      setFeedback({ type: "ok", text: "已删除" });
      onClose();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "删除失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const rebuild = async () => {
    if (!auth.client) return;
    setRebuilding(true);
    setFeedback(null);
    try {
      await triggerRebuild(auth.client, repo, { owner: pointer.owner, repo: pointer.repo });
      setFeedback({ type: "ok", text: "已触发重建，稍后刷新页面查看" });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "触发重建失败",
      });
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col border-l border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="编辑文档"
      >
        <header className="flex items-center gap-3 border-b border-[var(--ed-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {mode === "create" ? "新建文档" : "编辑文档"}
            </h2>
            <p className="truncate text-xs text-[var(--ed-text-muted)]">
              {branch}/{docPath}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
            aria-label="关闭编辑器"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {!auth.token ? (
            <TokenForm
              onSubmit={async (token, remember) => {
                await auth.signIn(token, remember);
              }}
              loading={auth.loading}
              error={auth.error}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SignedInBadge user={auth.user} token={auth.token} onSignOut={auth.signOut} />
                <button
                  type="button"
                  onClick={() => void loadFile()}
                  className="flex items-center gap-1.5 text-xs text-[var(--ed-text-muted)] hover:text-[var(--ed-primary)]"
                >
                  <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                  重新载入
                </button>
              </div>

              {loading ? (
                <div className="skeleton h-72 w-full" />
              ) : (
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  spellCheck={false}
                  className="h-[52vh] w-full resize-none rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg)] p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-[var(--ed-primary)]"
                  aria-label="文档内容"
                />
              )}

              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="提交信息"
                className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--ed-primary)]"
                aria-label="提交信息"
              />
            </div>
          )}
        </div>

        {auth.token ? (
          <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--ed-border)] px-4 py-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              提交到 {pointer.branch}
            </button>

            <button
              type="button"
              onClick={() => void rebuild()}
              disabled={rebuilding}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--ed-border)] px-3 py-2 text-sm text-[var(--ed-text-muted)] disabled:opacity-50"
            >
              {rebuilding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              立即重建
            </button>

            {sha ? (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-500 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                删除
              </button>
            ) : null}

            {feedback ? (
              <p
                className={`flex w-full items-center gap-1.5 text-xs ${
                  feedback.type === "ok" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {feedback.type === "ok" ? (
                  <Check className="size-3.5" />
                ) : (
                  <AlertCircle className="size-3.5" />
                )}
                {feedback.text}
              </p>
            ) : null}

            {!config.admin.enable ? (
              <p className="w-full text-xs text-amber-500">
                提示：config 中 admin.enable 已关闭，此入口下次构建后将隐藏。
              </p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
