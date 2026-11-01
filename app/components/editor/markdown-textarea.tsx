import { useEffect, useRef } from "react";

export interface MarkdownTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  className?: string;
}

/**
 * Markdown 源码编辑器
 *
 * - 等宽字体 + 行号栏（与 textarea 同步滚动）
 * - Tab 插入两个空格；Ctrl/Cmd+S 保存
 * - 自动感知深色模式
 */
export function MarkdownTextarea({ value, onChange, onSave, className }: MarkdownTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = value.split("\n").length;

  // 行号栏跟随滚动
  useEffect(() => {
    const textarea = textareaRef.current;
    const gutter = gutterRef.current;
    if (!textarea || !gutter) return;
    const sync = () => {
      gutter.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener("scroll", sync, { passive: true });
    return () => textarea.removeEventListener("scroll", sync);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart, selectionEnd } = target;
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = selectionStart + 2;
      });
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave?.();
      return;
    }
    // 回车自动续接列表标记
    if (event.key === "Enter") {
      const target = event.currentTarget;
      const { selectionStart } = target;
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = value.slice(lineStart, selectionStart);
      const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s+/);
      if (listMatch && currentLine.trim() !== listMatch[0].trim()) {
        event.preventDefault();
        const marker =
          listMatch[2].match(/^\d+\.$/)
            ? `${Number.parseInt(listMatch[2], 10) + 1}.`
            : listMatch[2];
        const insert = `\n${listMatch[1]}${marker} `;
        const next = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
        onChange(next);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = selectionStart + insert.length;
        });
      }
    }
  };

  return (
    <div className={`relative flex min-h-0 overflow-hidden rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg)] ${className ?? ""}`}>
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="shrink-0 select-none overflow-hidden border-r border-[var(--ed-border)] bg-[var(--ed-bg-subtle)] px-2 py-3 text-right font-mono text-[12px] leading-[1.65] text-[var(--ed-text-subtle)]"
      >
        {Array.from({ length: Math.max(lineCount, 1) }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        wrap="off"
        aria-label="Markdown 源码"
        className="min-h-0 flex-1 resize-none overflow-auto bg-transparent p-3 font-mono text-[13px] leading-[1.65] text-[var(--ed-text)] outline-none placeholder:text-[var(--ed-text-subtle)]"
        placeholder="在这里用 Markdown 编写文档…"
      />
    </div>
  );
}
