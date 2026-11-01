import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { createSearchEngine, toSearchHits, type SearchDoc, type SearchHit } from "~/lib/search";
import { docUrlPath } from "~/lib/content/routes";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  branches: Array<{ name: string; label: string }>;
  defaultBranch: string;
}

/**
 * 搜索面板
 *
 * 索引来源：构建产物 `search-index.{branch}.json`（按需惰性加载）。
 * 行为对齐 legacy：最小字符数、最大结果数、输入即搜。
 */
export function SearchDialog({ open, onClose, branches, defaultBranch }: SearchDialogProps) {
  const { config } = useSite();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeBranch, setActiveBranch] = useState(defaultBranch);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const engines = useRef(new Map<string, ReturnType<typeof createSearchEngine>>());
  const inputRef = useRef<HTMLInputElement>(null);

  const { min_chars, max_results, search_on_type } = config.search;

  const loadIndex = useCallback(
    async (branch: string) => {
      if (engines.current.has(branch)) return engines.current.get(branch)!;
      const response = await fetch(`/search-index.${encodeURIComponent(branch)}.json`);
      if (!response.ok) return null;
      const data = (await response.json()) as { docs: SearchDoc[] };
      const engine = createSearchEngine(data.docs ?? []);
      engines.current.set(branch, engine);
      return engine;
    },
    [],
  );

  // 打开时聚焦并预热当前版本索引
  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    void loadIndex(activeBranch);
    return () => window.clearTimeout(timer);
  }, [open, activeBranch, loadIndex]);

  // 检索
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < min_chars) {
      setHits([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const engine = await loadIndex(activeBranch);
      if (cancelled) return;
      setHits(engine ? toSearchHits(engine, trimmed, max_results) : []);
      setLoading(false);
      setActiveIndex(0);
    };

    if (search_on_type) {
      const timer = window.setTimeout(run, 140);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [query, activeBranch, open, min_chars, max_results, search_on_type, loadIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, hits.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter") {
      const hit = hits[activeIndex];
      if (hit) {
        onClose();
        navigate(docUrlPath({ branch: hit.branch, path: stripExtForRoute(hit.path) }));
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="搜索文档"
      >
        <div className="flex items-center gap-2 border-b border-[var(--ed-border)] px-4">
          <Search className="size-4 shrink-0 text-[var(--ed-text-subtle)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.search.placeholder}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[var(--ed-text-subtle)]"
            aria-label="搜索关键词"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg-subtle)]"
            aria-label="关闭搜索"
          >
            <X className="size-4" />
          </button>
        </div>

        {branches.length > 1 ? (
          <div className="flex gap-1 border-b border-[var(--ed-border)] px-3 py-2">
            {branches.map((branch) => (
              <button
                key={branch.name}
                type="button"
                onClick={() => setActiveBranch(branch.name)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  branch.name === activeBranch
                    ? "bg-[var(--ed-primary)] text-white"
                    : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
                }`}
              >
                {branch.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-[55vh] overflow-y-auto">
          {query.trim().length > 0 && query.trim().length < min_chars ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--ed-text-muted)]">
              请输入至少 {min_chars} 个字符
            </p>
          ) : null}

          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : null}

          {!loading && hits.length === 0 && query.trim().length >= min_chars ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--ed-text-muted)]">
              未找到与「{query}」匹配的文档
            </p>
          ) : null}

          {!loading && hits.length > 0 ? (
            <ul className="p-2">
              {hits.map((hit, index) => (
                <li key={`${hit.branch}/${hit.path}`}>
                  <Link
                    to={docUrlPath({
                      branch: hit.branch,
                      path: stripExtForRoute(hit.path),
                    })}
                    onClick={onClose}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`block rounded-lg px-3 py-2.5 transition-colors ${
                      index === activeIndex ? "bg-[var(--ed-bg-subtle)]" : ""
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span>{hit.title}</span>
                      {branches.length > 1 ? (
                        <span className="rounded bg-[var(--ed-bg-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--ed-text-subtle)]">
                          {hit.branch}
                        </span>
                      ) : null}
                    </p>
                    {hit.snippet ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--ed-text-muted)]">
                        {hit.snippet}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--ed-border)] px-4 py-2 text-[11px] text-[var(--ed-text-subtle)]">
          <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
          <span>{hits.length > 0 ? `${hits.length} 条结果` : ""}</span>
        </div>
      </div>
    </div>
  );
}

function stripExtForRoute(path: string): string {
  return path.replace(/\.(md|markdown|html?)$/i, "");
}
