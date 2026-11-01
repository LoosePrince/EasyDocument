import { useState } from "react";
import { KeyRound, LogOut, ShieldAlert } from "lucide-react";
import {
  clearToken,
  loadToken,
  maskToken,
  saveToken,
  wasRemembered,
} from "~/lib/github/credentials";
import { createClient, type GitHubClient, type UserInfo } from "~/lib/github/client";

export interface GitHubAuthState {
  client: GitHubClient | null;
  user: UserInfo | null;
  token: string | null;
  signIn: (token: string, remember: boolean) => Promise<void>;
  signOut: () => void;
  error: string | null;
  loading: boolean;
}

/** 凭据登录面板：输入 PAT → 校验 /user → 保存 */
export function useGitHubAuth(): GitHubAuthState {
  const stored = typeof window !== "undefined" ? loadToken() : null;
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [client, setClient] = useState<GitHubClient | null>(
    stored?.token ? createClient(stored.token) : null,
  );
  const [user, setUser] = useState<UserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (nextToken: string, remember: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const nextClient = createClient(nextToken.trim());
      const info = await nextClient.verify();
      saveToken(nextToken.trim(), remember);
      setToken(nextToken.trim());
      setClient(nextClient);
      setUser(info);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "验证失败");
      throw signInError;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    clearToken();
    setToken(null);
    setClient(null);
    setUser(null);
  };

  return { client, user, token, signIn, signOut, error, loading };
}

export function TokenForm({
  onSubmit,
  loading,
  error,
  compact,
}: {
  onSubmit: (token: string, remember: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(wasRemembered());

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        void onSubmit(value, remember);
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-medium" htmlFor="gh-token">
        GitHub Personal Access Token
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ed-text-subtle)]" />
          <input
            id="gh-token"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="github_pat_..."
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--ed-primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="rounded-lg bg-[var(--ed-primary)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "验证中…" : "连接"}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--ed-text-muted)]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="size-3.5 accent-[var(--ed-primary)]"
        />
        记住本设备（写入 localStorage，可随时清除）
      </label>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      {!compact ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>Token 仅保存在本浏览器，用于直接调用 GitHub API。</p>
            <p>
              建议使用 fine-grained PAT，权限最小化：仅本仓库，Contents 读写 + Actions 读写。
            </p>
            <p>在公用电脑上请勿勾选「记住本设备」，用完点击退出。</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function SignedInBadge({
  user,
  token,
  onSignOut,
}: {
  user: UserInfo | null;
  token: string | null;
  onSignOut: () => void;
}) {
  if (!token) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--ed-border)] px-2.5 py-1.5 text-xs">
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" className="size-5 rounded-full" />
      ) : null}
      <span className="font-medium">{user?.login ?? "已连接"}</span>
      <span className="text-[var(--ed-text-subtle)]">{maskToken(token)}</span>
      <button
        type="button"
        onClick={onSignOut}
        className="ml-1 flex items-center gap-1 text-[var(--ed-text-muted)] hover:text-red-500"
      >
        <LogOut className="size-3.5" />
        退出
      </button>
    </div>
  );
}
