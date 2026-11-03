import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table2,
  TriangleAlert,
} from "lucide-react";
import { MarkdownTextarea } from "./markdown-textarea";
import { PreviewPane } from "./preview-pane";
import { useSite } from "~/components/providers/config-provider";
import { useI18n } from "~/lib/i18n/provider";
import { warmPreviewRenderer } from "~/lib/markdown/preview";
import { cn } from "~/lib/utils";

export type EditorMode = "wysiwyg" | "rich" | "split";

export interface MarkdownWorkspaceProps {
  value: string;
  onChange: (value: string) => void;
  docPath: string;
  branch: string;
  /** 外部可切换模式 */
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onSave?: () => void;
}

const TOOLBAR: Array<{
  icon: React.ReactNode;
  label: string;
  before: string;
  after?: string;
  block?: boolean;
}> = [
  { icon: <Heading1 className="size-4" />, label: "一级标题", before: "# ", block: true },
  { icon: <Heading2 className="size-4" />, label: "二级标题", before: "## ", block: true },
  { icon: <Bold className="size-4" />, label: "加粗", before: "**", after: "**" },
  { icon: <Italic className="size-4" />, label: "斜体", before: "*", after: "*" },
  { icon: <Code2 className="size-4" />, label: "行内代码", before: "`", after: "`" },
  { icon: <Link2 className="size-4" />, label: "链接", before: "[", after: "](https://)" },
  { icon: <ImageIcon className="size-4" />, label: "图片", before: "![", after: "](./image.png)" },
  { icon: <List className="size-4" />, label: "无序列表", before: "- ", block: true },
  { icon: <ListOrdered className="size-4" />, label: "有序列表", before: "1. ", block: true },
  { icon: <Quote className="size-4" />, label: "引用", before: "> ", block: true },
  { icon: <TriangleAlert className="size-4" />, label: "提示框", before: "> [NOTE] ", block: true },
  { icon: <Table2 className="size-4" />, label: "表格", before: "| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |", block: true },
  { icon: <Minus className="size-4" />, label: "分隔线", before: "---", block: true },
];

/**
 * Markdown 工作区
 *
 * - 富文本模式：仅显示预览（隐藏源码），编辑通过双击预览区进入源码？
 *   —— 为保证「与实际渲染一致」，富文本模式实际是「占满宽度的实时预览 + 右侧大纲」，
 *      输入仍发生在源码层，但通过分隔条可随时展开源码。
 * - 分栏模式：左源码 / 右预览，滚动可同步。
 *
 * 两种模式使用同一渲染管线，因此预览即最终效果。
 */
export function MarkdownWorkspace({
  value,
  onChange,
  docPath,
  branch,
  mode,
  onSave,
}: MarkdownWorkspaceProps) {
  const { config, defaultBranch, branches } = useSite();
  const { documentLanguage } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [syncScroll, setSyncScroll] = useState(true);

  useEffect(() => {
    warmPreviewRenderer();
  }, []);

  /** 从当前光标/选区插入标记 */
  const applyToolbar = useCallback(
    (item: (typeof TOOLBAR)[number]) => {
      const textarea = containerRef.current?.querySelector("textarea");
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end);

      if (item.block) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const next = `${value.slice(0, lineStart)}${item.before}${value.slice(lineStart)}`;
        onChange(next);
        requestAnimationFrame(() => {
          const offset = lineStart + item.before.length;
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = offset;
        });
        return;
      }

      const insertText = `${item.before}${selected || "文字"}${item.after ?? ""}`;
      const next = value.slice(0, start) + insertText + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = selected ? start + insertText.length : start + item.before.length;
        textarea.selectionStart = start + item.before.length;
        textarea.selectionEnd = selected ? cursor : start + item.before.length;
      });
    },
    [onChange, value],
  );

  const previewProps = useMemo(
    () => ({
      markdown: value,
      docPath,
      branch,
      defaultBranch,
      versions: branches.map((b) => b.name),
      documentLanguage,
      indexPages: config.document.index_pages,
      supportedExtensions: config.document.supported_extensions,
      baseUrl: config.site.base_url,
      codeBlock: {
        lineNumbers: config.document.code_block.line_numbers,
        startLine: config.document.code_block.start_line,
        theme: {
          light: config.document.code_block.theme.light ?? "github-light",
          dark: config.document.code_block.theme.dark ?? "github-dark",
        },
      },
      codeCopyButton: config.document.code_copy_button,
      math: config.extensions.math,
      highlight: config.extensions.highlight,
      mermaid: config.extensions.mermaid,
      tocNumbering: config.document.toc_numbering,
      tocIgnoreH1: config.document.toc_ignore_h1,
    }),
    [value, docPath, branch, config, defaultBranch, branches, documentLanguage],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--ed-border)] pb-2">
        {TOOLBAR.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => applyToolbar(item)}
            className="grid size-8 place-items-center rounded-md text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)] disabled:opacity-40"
            disabled={mode === "rich"}
          >
            {item.icon}
          </button>
        ))}

        <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--ed-text-muted)]">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(event) => setSyncScroll(event.target.checked)}
            className="size-3.5 accent-[var(--ed-primary)]"
          />
          同步滚动
        </label>
      </div>

      <div ref={containerRef} className={cn("mt-2 grid min-h-0 flex-1 gap-3", mode === "split" ? "lg:grid-cols-2" : "grid-cols-1")}>
        {mode === "split" ? (
          <MarkdownTextarea
            value={value}
            onChange={onChange}
            onSave={onSave}
            className="min-h-[50vh]"
          />
        ) : null}

        <PreviewPane
          {...previewProps}
          syncScrollElement={mode === "split" && syncScroll ? containerRef.current?.querySelector("textarea") ?? null : null}
          className="min-h-[50vh] overflow-y-auto rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-5"
          emptyHint="在左侧输入 Markdown，这里会立即呈现与正式页面一致的渲染结果。"
        />
      </div>
    </div>
  );
}
