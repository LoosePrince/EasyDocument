import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { cn } from "~/lib/utils";

export interface WysiwygEditorProps {
  /** 渲染后的 HTML（与正式页面完全一致） */
  html: string;
  /** 编辑后回写 Markdown */
  onChange: (markdown: string) => void;
  className?: string;
}

/**
 * 所见即所得编辑器
 *
 * 直接在当前页面里编辑**渲染结果本身**（contenteditable），
 * 排版、代码块、提示框、表格都与发布效果一致；
 * 每次修改后用 turndown 反向转成 Markdown 写回草稿。
 *
 * 取舍：富文本层不重排代码高亮/KaTeX（编辑时保留原始 DOM），
 * 因此不会出现「编辑时好看、发布后变形」——发布仍是同一条渲染管线。
 */
export function WysiwygEditor({ html, onChange, className }: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>("");
  const [ready, setReady] = useState(false);

  // 只在进入编辑器/内容被外部替换时重建 DOM，避免输入过程中光标跳动
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (lastEmitted.current === html) return;
    editor.innerHTML = html;
    lastEmitted.current = html;
    setReady(true);
  }, [html]);

  const emit = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { htmlToMarkdown } = await import("~/lib/markdown/html-to-markdown");
    const markdown = htmlToMarkdown(editor.innerHTML);
    lastEmitted.current = markdown;
    onChange(markdown);
  }, [onChange]);

  const exec = useCallback(
    (command: string, value?: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      document.execCommand(command, false, value);
      void emit();
    },
    [emit],
  );

  const wrapBlock = useCallback(
    (tag: "h1" | "h2" | "h3" | "blockquote") => {
      exec("formatBlock", `<${tag}>`);
    },
    [exec],
  );

  const insertHtml = useCallback(
    (fragment: string) => {
      exec("insertHTML", fragment);
    },
    [exec],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--ed-border)] pb-2">
        <ToolbarButton label="一级标题" onClick={() => wrapBlock("h1")}>
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="二级标题" onClick={() => wrapBlock("h2")}>
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="三级标题" onClick={() => wrapBlock("h3")}>
          <Heading3 className="size-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="加粗" onClick={() => exec("bold")}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="斜体" onClick={() => exec("italic")}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="删除线" onClick={() => exec("strikeThrough")}>
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="行内代码" onClick={() => insertHtml("<code>代码</code>")}>
          <Code2 className="size-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="无序列表" onClick={() => exec("insertUnorderedList")}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="有序列表" onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="引用" onClick={() => wrapBlock("blockquote")}>
          <Quote className="size-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="链接" onClick={() => promptLink(exec)}>
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="提示框"
          onClick={() => insertHtml('<aside class="callout callout-note" data-callout="NOTE"><p>提示内容</p></aside>')}
        >
          <TriangleAlert className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="表格" onClick={() => insertHtml(buildTable())}>
          <Table2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="分隔线" onClick={() => exec("insertHorizontalRule")}>
          <Minus className="size-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="撤销" onClick={() => exec("undo")}>
          <Undo2 className="size-4" />
        </ToolbarButton>

        <span className="ml-auto text-[11px] text-[var(--ed-text-subtle)]">
          直接修改排版，右侧/下方内容即时同步为 Markdown
        </span>
      </div>

      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="所见即所得编辑区"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => void emit()}
        onBlur={() => void emit()}
        className={cn(
          "doc-content mt-3 min-h-[55vh] rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] p-6 outline-none",
          "focus:border-[var(--ed-primary)]",
          !ready && "opacity-0",
        )}
        // 粘贴时保留基本结构，避免把外部样式带进来
        onPaste={(event) => {
          const text = event.clipboardData.getData("text/plain");
          if (!text) return;
          event.preventDefault();
          document.execCommand("insertText", false, text);
        }}
      />
    </div>
  );
}

function promptLink(exec: (command: string, value?: string) => void) {
  const url = window.prompt("链接地址", "https://");
  if (!url) return;
  exec("createLink", url);
}

function buildTable(): string {
  const cell = "<td>内容</td>";
  return `<table><thead><tr><th>列 1</th><th>列 2</th></tr></thead><tbody><tr>${cell}${cell}</tr><tr>${cell}${cell}</tr></tbody></table>`;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // 防止编辑器失焦导致选区丢失
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--ed-border)]" aria-hidden="true" />;
}
