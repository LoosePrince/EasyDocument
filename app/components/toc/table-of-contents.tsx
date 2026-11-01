import { useEffect, useMemo, useState } from "react";

export interface TocHeading {
  id: string;
  text: string;
  depth: number;
  /** 编号（如 "1.2"），toc_numbering=false 时为空 */
  number?: string;
  /** 最近的、深度在 tocDepth 之内的祖先标题 id */
  anchorId?: string;
}

export interface TocProps {
  headings: TocHeading[];
  tocDepth: number;
  dynamicExpand: boolean;
  className?: string;
}

/**
 * 右侧目录
 *
 * - 只显示 depth <= tocDepth 的标题
 * - 超出深度的标题在 dynamicExpand 时，仅当「其归属的浅层标题」处于活动状态才显示
 * - 滚动高亮使用 IntersectionObserver（旧版有两套冲突实现，此处只保留一套）
 */
export function TableOfContents({ headings, tocDepth, dynamicExpand, className }: TocProps) {
  const [activeId, setActiveId] = useState("");

  const { inRange, overflow, ancestorOf } = useMemo(() => {
    const inRange: TocHeading[] = [];
    const overflow: TocHeading[] = [];
    const ancestorOf = new Map<string, string>();
    let currentAncestor = "";

    for (const heading of headings) {
      if (heading.depth <= tocDepth) {
        inRange.push(heading);
        currentAncestor = heading.id;
      } else {
        overflow.push(heading);
        ancestorOf.set(heading.id, heading.anchorId ?? currentAncestor);
      }
    }
    return { inRange, overflow, ancestorOf };
  }, [headings, tocDepth]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-12% 0px -72% 0px", threshold: [0, 1] },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);

  // 合并展示顺序：范围内的标题始终显示；越界标题按 dynamicExpand 决定
  const items = useMemo(() => {
    const list: Array<{ heading: TocHeading; visible: boolean }> = [];
    const activeHidden = dynamicExpand
      ? overflow.filter((heading) => ancestorOf.get(heading.id) === activeId).map((h) => h.id)
      : [];
    const expandFor = (id: string) => activeHidden.includes(id);

    let inRangeCursor = 0;
    for (const heading of headings) {
      if (heading.depth <= tocDepth) {
        list.push({ heading, visible: true });
        inRangeCursor += 1;
        continue;
      }
      list.push({ heading, visible: dynamicExpand && expandFor(heading.id) });
    }

    void inRangeCursor;
    return list;
  }, [headings, tocDepth, dynamicExpand, overflow, ancestorOf, activeId]);

  if (inRange.length === 0) {
    return (
      <aside className={className}>
        <p className="text-xs text-[var(--ed-text-subtle)]">本页暂无目录</p>
      </aside>
    );
  }

  return (
    <aside className={className} aria-label="本页目录">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ed-text-subtle)]">
        本页目录
      </p>
      <ul className="space-y-1 border-l border-[var(--ed-border)] text-[13px]">
        {items.map(({ heading, visible }) => (
          <li key={heading.id} className={visible ? "" : "hidden"}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById(heading.id);
                if (!target) return;
                const top = target.getBoundingClientRect().top + window.scrollY - 88;
                window.scrollTo({ top, behavior: "smooth" });
                window.history.replaceState(null, "", `#${heading.id}`);
              }}
              className={`block border-l-2 py-1 transition-colors ${
                activeId === heading.id
                  ? "border-[var(--ed-primary)] font-medium text-[var(--ed-primary)]"
                  : "border-transparent text-[var(--ed-text-muted)] hover:text-[var(--ed-text)]"
              }`}
              style={{ paddingLeft: `${Math.max(heading.depth - 1, 0) * 0.75 + 0.75}rem` }}
              aria-current={activeId === heading.id ? "location" : undefined}
            >
              {heading.number ? (
                <span className="mr-1.5 font-mono text-[11px] opacity-60">{heading.number}</span>
              ) : null}
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
