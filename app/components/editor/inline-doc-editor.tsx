import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Columns2, Eye, FileCode2, RotateCcw, Save, Undo2 } from "lucide-react";
import { MarkdownWorkspace, type EditorMode } from "./markdown-workspace";
import { MarkdownTextarea } from "./markdown-textarea";
import { useEditorContext } from "~/lib/editor/editor-store";
import { cn } from "~/lib/utils";

export interface InlineDocEditorProps {
  branch: string;
  /** 分支内真实路径，如 "使用指南/README.md" */
  docPath: string;
  /** 初始正文（构建期读取的原文） */
  initialContent: string;
  kind: "markdown" | "html";
  title: string;
  onExit: () => void;
}

/**
 * 就地文档编辑器
 *
 * 直接占用正文区域，不弹窗、不跳页：
 *  - Markdown：富文本预览（占满）或源码 + 预览分栏
 *  - HTML：源码 + 沙箱预览
 * 预览使用与构建期相同的渲染管线，所见即最终效果。
 */
export function InlineDocEditor({
  branch,
  docPath,
  initialContent,
  kind,
  title,
  onExit,
}: InlineDocEditorProps) {
  const { saveDraft, getDraft, removeDraft, drafts } = useEditorContext();

  const saved = getDraft(docPath);
  const [content, setContent] = useState(saved?.content ?? initialContent);
  const [docTitle, setDocTitle] = useState(saved?.title ?? title);
  const [mode, setMode] = useState<EditorMode>(kind === "html" ? "split" : "rich");
  const [htmlMode, setHtmlMode] = useState<"preview" | "split">("split");
  const [justSaved, setJustSaved] = useState(false);
  const initialRef = useRef(initialContent);

  /** 与「已保存草稿」或「线上原文」不同即为未保存 */
  const unsaved = content !== (saved?.content ?? initialRef.current) || docTitle !== (saved?.title ?? title);

  /** 本地保存：写入草稿（持久化到 localStorage），不联网 */
  const save = useCallback(() => {
    if (content === initialRef.current && docTitle === title) {
      // 与线上原文相同：清除草稿
      removeDraft(docPath);
      setJustSaved(true);
      return;
    }
    saveDraft({
      path: docPath,
      branch,
      kind: saved?.kind === "create" ? "create" : "update",
      content,
      title: docTitle,
      format: kind === "markdown" ? "md" : "html",
    });
    setJustSaved(true);
  }, [content, docTitle, docPath, branch, kind, initialRef, title, saved, saveDraft, removeDraft]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  return (
    <div className="flex min-h-[70vh] flex-col gap-3">
      {/* 编辑工具条 */}
      <div className="sticky top-[var(--ed-header-height)] z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)]/95 px-3 py-2 backdrop-blur">
        <span className="flex items-center gap-1.5 rounded-md bg-[var(--ed-primary-soft)] px-2 py-1 text-[11px] font-medium text-[var(--ed-primary)]">
          <FileCode2 className="size-3.5" />
          编辑中
        </span>

        <input
          value={docTitle}
          onChange={(event) => setDocTitle(event.target.value)}
          aria-label="文档标题"
          className="min-w-32 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none hover:border-[var(--ed-border)] focus:border-[var(--ed-primary)]"
        />

        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--ed-border)] p-0.5">
          <ModeButton
            active={kind === "html" ? htmlMode === "preview" : mode === "rich"}
            onClick={() => (kind === "html" ? setHtmlMode("preview") : setMode("rich"))}
            icon={<Eye className="size-3.5" />}
            label="预览"
          />
          <ModeButton
            active={kind === "html" ? htmlMode === "split" : mode === "split"}
            onClick={() => (kind === "html" ? setHtmlMode("split") : setMode("split"))}
            icon={<Columns2 className="size-3.5" />}
            label="分栏"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setContent(initialRef.current);
            setDocTitle(title);
            removeDraft(docPath);
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
          title="撤销全部未提交修改"
        >
          <Undo2 className="size-3.5" />
          还原
        </button>

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
        >
          <RotateCcw className="size-3.5" />
          退出编辑
        </button>

        <button
          type="button"
          onClick={save}
          disabled={!unsaved && !saved}
          title="保存到本地草稿（不联网）；切换页面后仍可继续查看"
          className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {justSaved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          {justSaved ? "已保存" : unsaved ? "保存修改" : "已保存"}
        </button>
      </div>

      <p className="text-[11px] text-[var(--ed-text-subtle)]">
        {saved
          ? `已保存到本地草稿（${new Date(saved.savedAt).toLocaleTimeString("zh-CN")}）· 共 ${drafts.length} 项待提交`
          : unsaved
            ? "有未保存的修改 · 点「保存修改」写入本地草稿"
            : "与线上内容一致"}
        {" · "}保存后可自由切换页面预览，确认无误再在顶部工具条「一键提交」。
      </p>

      {kind === "markdown" ? (
        <MarkdownWorkspace
          value={content}
          onChange={setContent}
          docPath={docPath}
          branch={branch}
          mode={mode}
          onModeChange={setMode}
          onSave={save}
        />
      ) : (
        <HtmlWorkspace
          value={content}
          onChange={setContent}
          mode={htmlMode}
          title={docTitle}
        />
      )}

      <p className="text-[11px] text-[var(--ed-text-subtle)]">
        预览与正式页面使用同一渲染管线。
      </p>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
        active
          ? "bg-[var(--ed-primary)] text-white"
          : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** HTML 文档：源码 + 沙箱预览 */
function HtmlWorkspace({
  value,
  onChange,
  mode,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: "preview" | "split";
  title: string;
}) {
  return (
    <div className={cn("grid min-h-0 flex-1 gap-3", mode === "split" && "lg:grid-cols-2")}>
      {mode === "split" ? (
        <MarkdownTextarea value={value} onChange={onChange} className="min-h-[55vh]" />
      ) : null}
      <iframe
        title={`${title} 预览`}
        srcDoc={value}
        sandbox="allow-same-origin"
        className="h-[70vh] w-full rounded-xl border border-[var(--ed-border)] bg-white"
      />
    </div>
  );
}

