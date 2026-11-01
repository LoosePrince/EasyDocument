/**
 * 网页端内容写操作
 *
 * 所有写入都落在内容分支（默认 data），不触碰代码分支。
 */
import type { GitHubClient, RepoRef } from "~/lib/github/client";

export interface WriteParams {
  branch: string;
  /** 分支内路径，如 "main/使用指南/新文档.md" */
  path: string;
  message: string;
}

export async function createFile(
  client: GitHubClient,
  repo: RepoRef,
  params: WriteParams & { content: string },
) {
  const existing = await client.getFile(repo, params.path, params.branch);
  if (existing) {
    throw new Error(`文件已存在：${params.path}`);
  }
  return client.putFile(repo, {
    path: params.path,
    branch: params.branch,
    content: params.content,
    message: params.message,
  });
}

export async function deleteFile(client: GitHubClient, repo: RepoRef, params: WriteParams) {
  const existing = await client.getFile(repo, params.path, params.branch);
  if (!existing) {
    throw new Error(`文件不存在：${params.path}`);
  }
  return client.deleteFile(repo, {
    path: params.path,
    branch: params.branch,
    sha: existing.sha,
    message: params.message,
  });
}

export async function updateFile(
  client: GitHubClient,
  repo: RepoRef,
  params: WriteParams & { content: string },
) {
  const existing = await client.getFile(repo, params.path, params.branch);
  if (!existing) {
    throw new Error(`文件不存在：${params.path}`);
  }
  return client.putFile(repo, {
    path: params.path,
    branch: params.branch,
    content: params.content,
    sha: existing.sha,
    message: params.message,
  });
}

/** 路径合法性：禁止 .. 与绝对路径，限制扩展名 */
export function assertSafeDocPath(path: string, supportedExtensions: string[]) {
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.includes("..")) {
    throw new Error("路径不合法");
  }
  const ext = clean.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  if (!supportedExtensions.includes(ext)) {
    throw new Error(`仅支持以下扩展名：${supportedExtensions.join(", ")}`);
  }
  return clean;
}
