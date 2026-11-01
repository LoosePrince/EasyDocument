/**
 * 一键重建：触发 GitHub Actions 工作流
 *
 * 端点：POST /repos/{owner}/{repo}/actions/workflows/{file}/dispatches
 * 参数：{ ref: <代码分支>, inputs?: {...} }
 * 要求：workflow 必须存在于 ref 所指分支上，且含 workflow_dispatch 触发器
 */
import type { GitHubClient, RepoRef } from "./client";

export const DEPLOY_WORKFLOW_FILE = "deploy.yml";
export const CODE_BRANCH = "main";

export interface RebuildOptions {
  /** 触发时使用的分支（工作流文件所在分支） */
  ref?: string;
  /** 传给工作流的输入参数 */
  inputs?: Record<string, string>;
}

export async function triggerRebuild(
  client: GitHubClient,
  repo: RepoRef,
  _target?: RepoRef,
  options: RebuildOptions = {},
): Promise<void> {
  await client.dispatchWorkflow(
    repo,
    DEPLOY_WORKFLOW_FILE,
    options.ref ?? CODE_BRANCH,
    options.inputs ?? { reason: "web-editor" },
  );
}

export async function fetchLatestRun(client: GitHubClient, repo: RepoRef) {
  return client.latestRun(repo, DEPLOY_WORKFLOW_FILE, CODE_BRANCH);
}
