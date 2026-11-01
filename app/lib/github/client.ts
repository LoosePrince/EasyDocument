/**
 * GitHub REST 客户端（浏览器直连）
 *
 * 覆盖网页端编辑所需能力：
 *  - 读取/写入/删除文件（Contents API，指定分支）
 *  - 触发工作流（workflow_dispatch）
 *  - 查询工作流运行状态
 *
 * 注意：api.github.com 返回 Access-Control-Allow-Origin: *，可跨域直连。
 */

const API_BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token: string;
  accept?: string;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: options.accept ?? "application/vnd.github+json",
      Authorization: `Bearer ${options.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }
    throw new GitHubApiError(describeError(response.status, details), response.status, details);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function describeError(status: number, details: unknown): string {
  const message =
    typeof details === "object" && details && "message" in details
      ? String((details as { message: unknown }).message)
      : "";
  switch (status) {
    case 401:
      return "Token 无效或已过期，请重新输入";
    case 403:
      return `权限不足或触发速率限制：${message || "请检查 Token 的 Contents / Actions 权限"}`;
    case 404:
      return "仓库或文件不存在，请检查 repo 与分支设置";
    case 409:
    case 422:
      return `内容已过期（可能已被他人修改），请刷新后重试：${message}`;
    default:
      return `GitHub API 错误 (${status})${message ? `：${message}` : ""}`;
  }
}

export interface UserInfo {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface FileContent {
  path: string;
  sha: string;
  content: string;
  size: number;
}

export interface RepoRef {
  owner: string;
  repo: string;
}

export function createClient(token: string) {
  const verify = () => request<UserInfo>("/user", { token });

  const getFile = async (
    ref: RepoRef,
    path: string,
    branch: string,
  ): Promise<FileContent | null> => {
    try {
      const data = await request<{
        path: string;
        sha: string;
        content?: string;
        encoding?: string;
        size: number;
      }>(`/repos/${ref.owner}/${ref.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`, {
        token,
      });
      const content =
        data.encoding === "base64" && data.content
          ? decodeBase64Utf8(data.content)
          : "";
      return { path: data.path, sha: data.sha, content, size: data.size };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return null;
      throw error;
    }
  };

  const putFile = (
    ref: RepoRef,
    params: { path: string; branch: string; content: string; message: string; sha?: string },
  ) =>
    request<{ content: { sha: string }; commit: { sha: string; html_url: string } }>(
      `/repos/${ref.owner}/${ref.repo}/contents/${encodeURIComponent(params.path)}`,
      {
        method: "PUT",
        token,
        body: {
          message: params.message,
          content: encodeBase64Utf8(params.content),
          branch: params.branch,
          ...(params.sha ? { sha: params.sha } : {}),
        },
      },
    );

  const deleteFile = (
    ref: RepoRef,
    params: { path: string; branch: string; message: string; sha: string },
  ) =>
    request<{ commit: { sha: string; html_url: string } }>(
      `/repos/${ref.owner}/${ref.repo}/contents/${encodeURIComponent(params.path)}`,
      {
        method: "DELETE",
        token,
        body: { message: params.message, branch: params.branch, sha: params.sha },
      },
    );

  /** 触发工作流（一键重建） */
  const dispatchWorkflow = (ref: RepoRef, workflowFile: string, branch: string, inputs?: Record<string, string>) =>
    request<void>(`/repos/${ref.owner}/${ref.repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      token,
      body: { ref: branch, ...(inputs ? { inputs } : {}) },
    });

  /** 查询最近一次工作流运行（用于显示进度） */
  const latestRun = async (ref: RepoRef, workflowFile: string, branch: string) => {
    const data = await request<{
      workflow_runs: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        html_url: string;
        created_at: string;
        head_branch: string;
      }>;
    }>(
      `/repos/${ref.owner}/${ref.repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=1`,
      { token },
    );
    return data.workflow_runs?.[0] ?? null;
  };

  return { verify, getFile, putFile, deleteFile, dispatchWorkflow, latestRun };
}

export type GitHubClient = ReturnType<typeof createClient>;

/** 分支列表（编辑台用于展示可选版本） */
export async function listBranches(token: string, ref: RepoRef): Promise<string[]> {
  const data = await request<Array<{ name: string }>>(
    `/repos/${ref.owner}/${ref.repo}/branches?per_page=100`,
    { token },
  );
  return data.map((branch) => branch.name);
}

export function decodeBase64Utf8(input: string): string {
  const binary = atob(input.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
