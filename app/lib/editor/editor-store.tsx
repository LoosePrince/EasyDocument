/**
 * 站点编辑状态（浏览器端）
 *
 * 统一管理：
 *  - PAT 凭据
 *  - 草稿（正文 / 新增 / 删除 / 重命名 / 排序）
 *  - 与 GitHub 的读取、提交、重建
 *
 * 侧栏、文档页、控制台共享同一份状态，因此「侧栏里改标题」会立即反映到正文区与待提交列表。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UserInfo } from "~/lib/github/client";
import { createClient, type GitHubClient, type RepoRef } from "~/lib/github/client";
import { clearToken, loadToken, saveToken } from "~/lib/github/credentials";
import type { BranchLandingData, DocPageData } from "~/lib/site/page.server";
import type { DocsNode } from "~/lib/content/types";

export type DraftKind = "update" | "create" | "delete";

export interface DraftEntry {
  /** 分支内路径（写入/删除的目标文件） */
  path: string;
  branch: string;
  kind: DraftKind;
  /** update/create 的正文（Markdown 或配置源码） */
  content?: string;
  /** 基线 sha：用于乐观并发控制；新建为 undefined */
  baseSha?: string;
  /** 展示用标题 */
  title: string;
  /** 本次新建时的模板类型 */
  format?: "md" | "html";
}

export interface CommitResult {
  committed: number;
  commitUrl?: string;
}

export interface EditorContextValue {
  // 凭据
  token: string | null;
  user: UserInfo | null;
  authError: string | null;
  authLoading: boolean;
  signIn: (token: string, remember: boolean) => Promise<void>;
  signOut: () => void;
  client: GitHubClient | null;
  repo: RepoRef;

  // 编辑模式
  editing: boolean;
  setEditing: (value: boolean) => void;
  canEdit: boolean;

  // 草稿
  drafts: DraftEntry[];
  dirty: boolean;
  getDraft: (path: string) => DraftEntry | undefined;
  setDraft: (draft: DraftEntry) => void;
  removeDraft: (path: string) => void;
  discardAll: () => void;

  // 提交
  submitting: boolean;
  submitError: string | null;
  commit: (message: string) => Promise<CommitResult>;
  rebuild: () => Promise<void>;
  rebuilding: boolean;

  // 草稿预览（供侧栏即时反映改名/新增/删除）
  previewTree: (tree: DocsNode) => DocsNode;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditorContext 必须在 EditorProvider 内使用");
  return value;
}

export interface EditorProviderProps {
  repo: RepoRef;
  dataBranch: string;
  canEdit: boolean;
  children: React.ReactNode;
}

export function EditorProvider({ repo, dataBranch, canEdit, children }: EditorProviderProps) {
  const stored = typeof window !== "undefined" ? loadToken() : null;
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [client, setClient] = useState<GitHubClient | null>(
    stored?.token ? createClient(stored.token) : null,
  );
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [editing, setEditingRaw] = useState(false);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const signIn = useCallback(async (nextToken: string, remember: boolean) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextClient = createClient(nextToken.trim());
      const info = await nextClient.verify();
      saveToken(nextToken.trim(), remember);
      setToken(nextToken.trim());
      setClient(nextClient);
      setUser(info);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "验证失败");
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setToken(null);
    setClient(null);
    setUser(null);
    setEditingRaw(false);
    setDrafts([]);
  }, []);

  const setEditing = useCallback((value: boolean) => {
    setEditingRaw(value);
    if (!value) setSubmitError(null);
  }, []);

  const getDraft = useCallback(
    (path: string) => drafts.find((draft) => draft.path === path),
    [drafts],
  );

  const upsertDraft = useCallback(
    (draft: DraftEntry) => {
      setDrafts((current) => {
        const existingIndex = current.findIndex((item) => item.path === draft.path);
        // 新建后又删除 → 直接移除草稿
        if (existingIndex === -1) return [...current, draft];
        const existing = current[existingIndex];
        if (draft.kind === "delete" && existing.kind === "create") {
          return current.filter((item) => item.path !== draft.path);
        }
        if (draft.kind === "create" && existing.kind === "delete") {
          // 删除后重建同一路径：保留原 baseSha 语义（这里简化为覆盖）
          const next = [...current];
          next[existingIndex] = { ...draft, baseSha: existing.baseSha };
          return next;
        }
        const next = [...current];
        next[existingIndex] = { ...existing, ...draft, baseSha: existing.baseSha ?? draft.baseSha };
        return next;
      });
    },
    [],
  );

  const removeDraft = useCallback((path: string) => {
    setDrafts((current) => current.filter((draft) => draft.path !== path));
  }, []);

  const discardAll = useCallback(() => setDrafts([]), []);

  /** 草稿应用到树：改名 / 删除 / 新增预览 */
  const previewTree = useCallback(
    (tree: DocsNode): DocsNode => {
      if (drafts.length === 0) return tree;

      const titleByPath = new Map<string, string>();
      const deleted = new Set<string>();
      const created: DraftEntry[] = [];

      for (const draft of drafts) {
        if (draft.kind === "delete") deleted.add(draft.path);
        else if (draft.kind === "create") created.push(draft);
        else titleByPath.set(draft.path, draft.title);
      }

      const clone = structuredClone(tree);

      const walk = (node: DocsNode): boolean => {
        const isFile = node.children.length === 0 && !node.index;
        if (deleted.has(node.path)) return false;
        if (isFile) {
          const nextTitle = titleByPath.get(node.path);
          if (nextTitle) node.title = nextTitle;
          return true;
        }
        if (node.index) {
          if (deleted.has(node.index.path)) {
            node.index = undefined;
          } else {
            const nextTitle = titleByPath.get(node.index.path);
            if (nextTitle) node.index.title = nextTitle;
          }
        }
        node.children = node.children.filter(walk);
        return Boolean(node.index) || node.children.length > 0;
      };

      walk(clone);

      // 新建条目：按路径挂到对应目录
      for (const draft of created) {
        const segments = draft.path.split("/").filter(Boolean);
        segments.pop();
        let cursor = clone;
        for (const segment of segments) {
          let next = cursor.children.find((child) => child.path.endsWith(`/${segment}`) || child.path === segment);
          if (!next) {
            next = {
              title: segment,
              path: [...cursor.path.split("/").filter(Boolean), segment].join("/"),
              children: [],
            };
            cursor.children.push(next);
          }
          cursor = next;
        }
        cursor.children.push({ title: draft.title, path: draft.path, children: [] });
      }

      return clone;
    },
    [drafts],
  );

  /** 提交全部草稿：逐个文件写/删，最后可选触发重建 */
  const commit = useCallback(
    async (message: string): Promise<CommitResult> => {
      if (!client) throw new Error("请先登录 GitHub");
      if (drafts.length === 0) throw new Error("没有待提交的修改");

      setSubmitting(true);
      setSubmitError(null);
      let committed = 0;

      try {
        for (const draft of drafts) {
          if (draft.kind === "delete") {
            if (!draft.baseSha) {
              const file = await client.getFile(repo, draft.path, dataBranch);
              if (!file) continue;
              await client.deleteFile(repo, {
                path: draft.path,
                branch: dataBranch,
                sha: file.sha,
                message: `${message}\n\n删除 ${draft.path}`,
              });
            } else {
              await client.deleteFile(repo, {
                path: draft.path,
                branch: dataBranch,
                sha: draft.baseSha,
                message: `${message}\n\n删除 ${draft.path}`,
              });
            }
            committed += 1;
            continue;
          }

          let sha = draft.baseSha;
          if (draft.kind === "update" && !sha) {
            const file = await client.getFile(repo, draft.path, dataBranch);
            sha = file?.sha;
          }

          await client.putFile(repo, {
            path: draft.path,
            branch: dataBranch,
            content: draft.content ?? "",
            sha,
            message: `${message}\n\n${draft.kind === "create" ? "新增" : "更新"} ${draft.path}`,
          });
          committed += 1;
        }

        setDrafts((current) =>
          current
            .filter((draft) => draft.kind !== "delete")
            .map((draft) => ({ ...draft, kind: "update" as const, baseSha: undefined })),
        );
        return { committed };
      } catch (error) {
        const text = error instanceof Error ? error.message : "提交失败";
        setSubmitError(text);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [client, dataBranch, drafts, repo],
  );

  const rebuild = useCallback(async () => {
    if (!client) throw new Error("请先登录 GitHub");
    setRebuilding(true);
    try {
      await client.dispatchWorkflow(repo, "deploy.yml", "main", { reason: "web-editor" });
    } finally {
      setRebuilding(false);
    }
  }, [client, repo]);

  // 页面关闭前提醒未提交的修改
  const dirty = drafts.length > 0;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const value = useMemo<EditorContextValue>(
    () => ({
      token,
      user,
      authError,
      authLoading,
      signIn,
      signOut,
      client,
      repo,
      editing,
      setEditing,
      canEdit,
      drafts,
      dirty,
      getDraft,
      setDraft: upsertDraft,
      removeDraft,
      discardAll,
      submitting,
      submitError,
      commit,
      rebuild,
      rebuilding,
      previewTree,
    }),
    [
      token,
      user,
      authError,
      authLoading,
      signIn,
      signOut,
      client,
      repo,
      editing,
      setEditing,
      canEdit,
      drafts,
      dirty,
      getDraft,
      upsertDraft,
      removeDraft,
      discardAll,
      submitting,
      submitError,
      commit,
      rebuild,
      rebuilding,
      previewTree,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export type { DocPageData, BranchLandingData };
