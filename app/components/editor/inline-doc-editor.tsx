import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Eye, FileCode2, Loader2, RotateCcw, Save, Undo2 } from "lucide-react";
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
  const { setDraft, getDraft, removeDraft, commit, submitting, submitError, dirty } =
    useEditorContext();

  const draft = getDraft(docPath);
  const [content, setContent] = useState(draft?.content ?? initialContent);
  const [docTitle, setDocTitle] = useState(draft?.title ?? title);
  const [mode, setMode] = useState<EditorMode>(kind === "html" ? "split" : "rich");
  const [htmlMode, setHtmlMode] = useState<"preview" | "split">("split");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef(initialContent);

  const changed = content !== initialRef.current || docTitle !== title;

  // 同步到草稿（防抖，避免每次敲键都触发全局重渲染）
  useEffect(() => {
    if (!changed) {
      removeDraft(docPath);
      return;
    }
    const timer = window.setTimeout(() => {
      setDraft({
        path: docPath,
        branch,
        kind: "update",
        content,
        title: docTitle,
        format: kind === "markdown" ? "md" : "html",
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [content, docTitle, changed, docPath, branch, kind, setDraft, removeDraft]);

  const save = useCallback(async () => {
    setError(null);
    try {
      const result = await commit(`docs(${branch}): 更新 ${docPath}`);
      initialRef.current = content;
      setSavedAt(`${result.committed} 个文件`);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "提交失败");
    }
  }, [commit, content, branch, docPath]);

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
          onClick={() => void save()}
          disabled={submitting || !changed}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          提交
        </button>
      </div>

      {savedAt ? (
        <p className="text-xs text-emerald-500">已提交 {savedAt}；如需上线请到编辑台触发重建。</p>
      ) : null}
      {error ?? submitError ? (
        <p className="text-xs text-red-500">{error ?? submitError}</p>
      ) : null}

      {kind === "markdown" ? (
        <MarkdownWorkspace
          value={content}
          onChange={setContent}
          docPath={docPath}
          branch={branch}
          mode={mode}
          onModeChange={setMode}
          onSave={() => void save()}
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
        {dirty ? " 当前有多处未提交修改。" : ""}
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

