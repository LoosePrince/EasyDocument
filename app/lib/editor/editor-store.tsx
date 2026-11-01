/**
 * 站点编辑状态（浏览器端）
 *
 * 语义分成两层，界限清晰：
 *
 *  SAVE（保存）   → 只在本地记录草稿，可在页面间切换继续查看/编辑；不联网、不需要登录
 *  COMMIT（提交） → 把全部草稿一次性推送到内容分支的 GitHub（需要 PAT）
 *  REBUILD（构建）→ 到控制台手动触发 Actions，让线上生效
 *
 * 草稿持久化在 localStorage，刷新/切页不丢失；显式「放弃」才清除。
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
  /** 展示用标题 */
  title: string;
  /** 本次新建时的模板类型 */
  format?: "md" | "html";
  /** 保存时间戳 */
  savedAt: number;
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

  // 本地草稿（保存）
  drafts: DraftEntry[];
  dirty: boolean;
  getDraft: (path: string) => DraftEntry | undefined;
  saveDraft: (draft: Omit<DraftEntry, "savedAt">) => void;
  removeDraft: (path: string) => void;
  discardAll: () => void;

  // 推送到 GitHub（提交）
  submitting: boolean;
  submitError: string | null;
  commit: (message: string) => Promise<CommitResult>;

  // 触发重建
  rebuild: () => Promise<void>;
  rebuilding: boolean;
  lastCommit?: { at: number; count: number };

  // 草稿预览（供侧栏即时反映改名/新增/删除）
  previewTree: (tree: DocsNode) => DocsNode;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditorContext 必须在 EditorProvider 内使用");
  return value;
}

const DRAFTS_KEY = "easydocument:drafts";

function readDrafts(): DraftEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DraftEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: DraftEntry[]) {
  if (typeof window === "undefined") return;
  try {
    if (drafts.length === 0) window.localStorage.removeItem(DRAFTS_KEY);
    else window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // 配额不足时静默失败：草稿仍在内存中
  }
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
  const [drafts, setDraftsState] = useState<DraftEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [lastCommit, setLastCommit] = useState<{ at: number; count: number } | undefined>();

  // 首次挂载后读取本地草稿（避免 SSR 期间访问 localStorage）
  useEffect(() => {
    setDraftsState(readDrafts());
  }, []);

  const setDrafts = useCallback((next: DraftEntry[] | ((current: DraftEntry[]) => DraftEntry[])) => {
    setDraftsState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      writeDrafts(resolved);
      return resolved;
    });
  }, []);

  // 多标签页同步
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== DRAFTS_KEY) return;
      setDraftsState(readDrafts());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

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
    // 退出登录不清草稿：草稿属于本地内容，不应因断开账号而丢失
  }, []);

  const setEditing = useCallback((value: boolean) => {
    setEditingRaw(value);
    if (!value) setSubmitError(null);
  }, []);

  const getDraft = useCallback(
    (path: string) => drafts.find((draft) => draft.path === path),
    [drafts],
  );

  /** 保存到本地草稿（不联网） */
  const saveDraft = useCallback(
    (draft: Omit<DraftEntry, "savedAt">) => {
      setDrafts((current) => {
        const existingIndex = current.findIndex((item) => item.path === draft.path);
        const entry: DraftEntry = { ...draft, savedAt: Date.now() };

        if (existingIndex === -1) return [...current, entry];

        const existing = current[existingIndex];
        // 新建后删除 → 直接移除草稿
        if (draft.kind === "delete" && existing.kind === "create") {
          return current.filter((item) => item.path !== draft.path);
        }
        const next = [...current];
        next[existingIndex] =
          draft.kind === "create" && existing.kind === "update"
            ? entry // 原有文件被改写内容：仍视为修改
            : { ...existing, ...entry };
        return next;
      });
    },
    [setDrafts],
  );

  const removeDraft = useCallback(
    (path: string) => {
      setDrafts((current) => current.filter((draft) => draft.path !== path));
    },
    [setDrafts],
  );

  const discardAll = useCallback(() => setDrafts([]), [setDrafts]);

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
          let next = cursor.children.find(
            (child) => child.path.endsWith(`/${segment}`) || child.path === segment,
          );
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

  /** 把本地草稿推送到 GitHub（需要 PAT） */
  const commit = useCallback(
    async (message: string): Promise<CommitResult> => {
      if (!client) throw new Error("请先连接 GitHub");
      if (drafts.length === 0) throw new Error("没有待提交的修改");

      setSubmitting(true);
      setSubmitError(null);
      let committed = 0;

      try {
        for (const draft of drafts) {
          if (draft.kind === "delete") {
            const file = await client.getFile(repo, draft.path, dataBranch);
            if (!file) continue;
            await client.deleteFile(repo, {
              path: draft.path,
              branch: dataBranch,
              sha: file.sha,
              message: `${message}\n\n删除 ${draft.path}`,
            });
            committed += 1;
            continue;
          }

          // update 需要远端 sha；create 若远端已存在（他人新建）则覆盖
          const remote = await client.getFile(repo, draft.path, dataBranch);
          await client.putFile(repo, {
            path: draft.path,
            branch: dataBranch,
            content: draft.content ?? "",
            sha: remote?.sha,
            message: `${message}\n\n${remote ? "更新" : "新增"} ${draft.path}`,
          });
          committed += 1;
        }

        setDrafts([]);
        setLastCommit({ at: Date.now(), count: committed });
        return { committed };
      } catch (error) {
        const text = error instanceof Error ? error.message : "提交失败";
        setSubmitError(text);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [client, dataBranch, drafts, repo, setDrafts],
  );

  const rebuild = useCallback(async () => {
    if (!client) throw new Error("请先连接 GitHub");
    setRebuilding(true);
    try {
      await client.dispatchWorkflow(repo, "deploy.yml", "main", { reason: "web-editor" });
    } finally {
      setRebuilding(false);
    }
  }, [client, repo]);

  // 关闭标签页前提醒未提交的修改
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
      saveDraft,
      removeDraft,
      discardAll,
      submitting,
      submitError,
      commit,
      rebuild,
      rebuilding,
      lastCommit,
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
      saveDraft,
      removeDraft,
      discardAll,
      submitting,
      submitError,
      commit,
      rebuild,
      rebuilding,
      lastCommit,
      previewTree,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export type { DocPageData, BranchLandingData };
