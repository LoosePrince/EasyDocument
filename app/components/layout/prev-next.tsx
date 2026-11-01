import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useSite } from "~/components/providers/config-provider";
import { docUrlPath } from "~/lib/content/routes";
import { stripExtension } from "~/lib/content/types";

export function PrevNext({
  branch,
  prev,
  next,
}: {
  branch: string;
  prev: { path: string; title: string } | null;
  next: { path: string; title: string } | null;
}) {
  const { config } = useSite();
  if (!config.navigation.prev_next_buttons) return null;
  if (!prev && !next) return null;

  return (
    <nav className="mt-10 grid gap-3 sm:grid-cols-2" aria-label="文档翻页">
      {prev ? (
        <Link
          to={docUrlPath({ branch, path: stripExtension(prev.path) })}
          className="group flex flex-col gap-1 rounded-xl border border-[var(--ed-border)] p-3.5 transition-colors hover:border-[var(--ed-primary)]"
        >
          <span className="flex items-center gap-1.5 text-xs text-[var(--ed-text-muted)]">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            上一篇
          </span>
          <span className="truncate text-sm font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}

      {next ? (
        <Link
          to={docUrlPath({ branch, path: stripExtension(next.path) })}
          className="group flex flex-col items-end gap-1 rounded-xl border border-[var(--ed-border)] p-3.5 text-right transition-colors hover:border-[var(--ed-primary)] sm:col-start-2"
        >
          <span className="flex items-center gap-1.5 text-xs text-[var(--ed-text-muted)]">
            下一篇
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="truncate text-sm font-medium">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
