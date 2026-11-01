import { Clock } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import type { GitInfo } from "~/lib/content/types";

/** 文档最后编辑时间与贡献者（构建期注入的 git 信息，缺省则隐藏） */
export function DocGitInfo({ git, editUrl }: { git?: GitInfo; editUrl?: string }) {
  const { config } = useSite();
  if (!git) return null;

  const { git: gitConfig, github } = config.extensions;
  const showModified = gitConfig.enable && gitConfig.show_last_modified && git.last_modified;
  const showContributors =
    gitConfig.enable && gitConfig.show_contributors && (git.contributors?.length ?? 0) > 0;

  if (!showModified && !showContributors && !editUrl) return null;

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--ed-border)] pt-4 text-xs text-[var(--ed-text-muted)]">
      {showModified && git.last_modified ? (
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          <span>最后编辑于</span>
          <time dateTime={new Date(git.last_modified.timestamp).toISOString()}>
            {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
              new Date(git.last_modified.timestamp),
            )}
          </time>
          <span className="opacity-70">{git.last_modified.author}</span>
        </span>
      ) : null}

      {showContributors && git.contributors ? (
        <span className="flex items-center gap-2">
          <span>贡献者</span>
          <span className="flex -space-x-1.5">
            {git.contributors.slice(0, 8).map((contributor) =>
              github.show_avatar && contributor.github_avatar ? (
                <img
                  key={contributor.name}
                  src={contributor.github_avatar}
                  alt={contributor.name}
                  title={`${contributor.name} (${contributor.commits})`}
                  className="size-6 rounded-full border-2 border-[var(--ed-bg-elevated)]"
                  loading="lazy"
                />
              ) : (
                <span
                  key={contributor.name}
                  title={`${contributor.name} (${contributor.commits})`}
                  className="grid size-6 place-items-center rounded-full border-2 border-[var(--ed-bg-elevated)] bg-[var(--ed-bg-subtle)] text-[10px]"
                >
                  {contributor.name.slice(0, 1)}
                </span>
              ),
            )}
          </span>
        </span>
      ) : null}

      {editUrl ? (
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[var(--ed-primary)] hover:underline"
        >
          在 GitHub 上编辑
        </a>
      ) : null}
    </div>
  );
}
