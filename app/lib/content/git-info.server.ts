/**
 * 构建期 git 信息（v2.0.2 修复）
 *
 * 用 `git log` 一次性扫描内容工作区，得到每个文件的最后修改与贡献者。
 * 设计为「尽力而为」：没有 .git、git 不可用或超时都返回空表，
 * 页面只是隐藏 git 信息，不会影响构建。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInfo } from "./types";

const execFileAsync = promisify(execFile);

interface CommitRecord {
  name: string;
  email: string;
  timestamp: number;
  message: string;
}

interface FileHistory {
  last?: CommitRecord;
  contributors: Map<string, { name: string; email: string; commits: number; timestamp: number }>;
}

export interface LoadGitInfoOptions {
  /** 最多扫描的提交数，避免超大仓库拖慢构建 */
  maxCommits?: number;
  timeoutMs?: number;
}

/**
 * @param gitDir 内容工作区目录（例如 .data）
 * @param paths  需要 git 信息的路径（相对内容根）
 * @param rootDir 内容根在内容工作区中的前缀（通常为空）
 */
export async function loadGitInfo(
  gitDir: string,
  paths: string[],
  rootDir = "",
  options: LoadGitInfoOptions = {},
): Promise<Record<string, GitInfo>> {
  if (paths.length === 0) return {};

  const maxCommits = options.maxCommits ?? 400;
  const timeout = options.timeoutMs ?? 20_000;

  let stdout: string;
  try {
    const result = await execFileAsync(
      "git",
      [
        "-C",
        gitDir,
        "-c",
        "core.quotepath=false",
        "log",
        `-n${maxCommits}`,
        "--format=@@ED@@%x1f%an%x1f%ae%x1f%at%x1f%s",
        "--name-only",
        "--",
        ".",
      ],
      { timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
    );
    stdout = result.stdout;
  } catch {
    return {};
  }

  const history = new Map<string, FileHistory>();
  const wanted = new Set(paths.map((item) => item.replace(/\\/g, "/").replace(/^\/+/, "")));

  for (const block of stdout.split("@@ED@@")) {
    const text = block.startsWith("﻿") ? block.slice(1) : block;
    if (!text.trim()) continue;
    const lines = text.split(/\r?\n/);
    let header = lines.shift() ?? "";
    if (header.startsWith("\u001f")) header = header.slice(1);
    const [name, email, timestamp, ...messageParts] = header.split("\u001f");
    if (!name || !timestamp) continue;
    const record: CommitRecord = {
      name,
      email: email ?? "",
      timestamp: Number(timestamp) * 1000,
      message: messageParts.join("\u001f").trim(),
    };
    if (!Number.isFinite(record.timestamp)) continue;

    for (const line of lines) {
      let filePath = line.trim();
      if (!filePath) continue;
      try {
        filePath = decodeURIComponent(filePath);
      } catch {
        // 保留原样
      }
      if (rootDir && filePath.startsWith(`${rootDir}/`)) {
        filePath = filePath.slice(rootDir.length + 1);
      }
      if (!wanted.has(filePath)) continue;

      let entry = history.get(filePath);
      if (!entry) {
        entry = { contributors: new Map() };
        history.set(filePath, entry);
      }
      if (!entry.last) entry.last = record;

      const key = record.email || record.name;
      const contributor = entry.contributors.get(key);
      if (contributor) {
        contributor.commits += 1;
        contributor.timestamp = Math.max(contributor.timestamp, record.timestamp);
      } else {
        entry.contributors.set(key, {
          name: record.name,
          email: record.email,
          commits: 1,
          timestamp: record.timestamp,
        });
      }
    }
  }

  const result: Record<string, GitInfo> = {};
  for (const [filePath, entry] of history) {
    const git: GitInfo = {};
    if (entry.last) {
      const username = githubUsername(entry.last.email);
      git.last_modified = {
        timestamp: entry.last.timestamp,
        author: entry.last.name,
        email: entry.last.email,
        message: entry.last.message,
        ...(username
          ? {
              github_username: username,
              github_avatar: `https://github.com/${username}.png?size=64`,
            }
          : {}),
      };
    }
    if (entry.contributors.size > 0) {
      git.contributors = [...entry.contributors.values()]
        .sort((a, b) => b.commits - a.commits || b.timestamp - a.timestamp)
        .slice(0, 8)
        .map((contributor) => {
          const username = githubUsername(contributor.email);
          return {
            name: contributor.name,
            email: contributor.email,
            commits: contributor.commits,
            last_commit_timestamp: contributor.timestamp,
            ...(username
              ? {
                  github_username: username,
                  github_avatar: `https://github.com/${username}.png?size=64`,
                }
              : {}),
          };
        });
    }
    result[filePath] = git;
  }

  return result;
}

/** 从 GitHub noreply 邮箱推断用户名：123+user@users.noreply.github.com */
function githubUsername(email: string): string | undefined {
  const match = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
  return match?.[1];
}
