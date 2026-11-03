import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Columns2,
  Eye,
  FileCode2,
  PenLine,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { MarkdownWorkspace, type EditorMode } from "./markdown-workspace";
import { MarkdownTextarea } from "./markdown-textarea";
import { WysiwygEditor } from "./wysiwyg-editor";
import { useEditorContext } from "~/lib/editor/editor-store";
import { useSite } from "~/components/providers/config-provider";
import { useI18n } from "~/lib/i18n/provider";
import { renderPreview } from "~/lib/markdown/preview";
import { cn } from "~/lib/utils";

export interface InlineDocEditorProps {
  branch: string;
  /** 逻辑路径（URL / 侧栏使用），如 "使用指南/README.md" */
  docPath: string;
  /** 实际写入的文件路径（多语言后缀/文件夹），缺省时等于 docPath */
  draftPath?: string;
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
  draftPath,
  initialContent,
  kind,
  title,
  onExit,
}: InlineDocEditorProps) {
  const storagePath = draftPath ?? docPath;
  const { saveDraft, getDraft, removeDraft, drafts } = useEditorContext();
  const { config, defaultBranch, branches } = useSite();
  const { t, language, documentLanguage } = useI18n();

  const saved = getDraft(docPath);
  const [content, setContent] = useState(saved?.content ?? initialContent);
  const [docTitle, setDocTitle] = useState(saved?.title ?? title);
  // 默认进入「所见即所得」：直接编辑当前页面的渲染结果
  const [mode, setMode] = useState<EditorMode>("wysiwyg");
  const [htmlMode, setHtmlMode] = useState<"preview" | "split">("split");
  const [justSaved, setJustSaved] = useState(false);
  const initialRef = useRef(initialContent);
  const [wysiwygHtml, setWysiwygHtml] = useState("");

  // 所见即所得模式需要「当前 Markdown 的渲染结果」作为编辑起点
  useEffect(() => {
    if (mode !== "wysiwyg" || kind !== "markdown") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void renderPreview({
        markdown: content,
        docPath,
        branch,
        defaultBranch,
        versions: branches.map((item) => item.name),
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
      }).then((result) => {
        if (!cancelled) setWysiwygHtml(result.html);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // 只在切换模式或外部内容变化时重建编辑起点
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, kind, docPath, branch]);

  const modeOptions = useMemo(
    () =>
      kind === "markdown"
        ? ([
            { id: "wysiwyg", label: t("所见即所得"), icon: <PenLine className="size-3.5" /> },
            { id: "split", label: t("分栏"), icon: <Columns2 className="size-3.5" /> },
            { id: "rich", label: t("预览"), icon: <Eye className="size-3.5" /> },
          ] as const)
        : ([
            { id: "preview", label: t("预览"), icon: <Eye className="size-3.5" /> },
            { id: "split", label: t("分栏"), icon: <Columns2 className="size-3.5" /> },
          ] as const),
    [kind, t],
  );

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
      sourcePath: storagePath,
      branch,
      kind: saved?.kind === "create" ? "create" : "update",
      content,
      title: docTitle,
      format: kind === "markdown" ? "md" : "html",
    });
    setJustSaved(true);
  }, [content, docTitle, docPath, storagePath, branch, kind, initialRef, title, saved, saveDraft, removeDraft]);

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
          {t("编辑中")}
        </span>

        <input
          value={docTitle}
          onChange={(event) => setDocTitle(event.target.value)}
          aria-label={t("文档标题")}
          className="min-w-32 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none hover:border-[var(--ed-border)] focus:border-[var(--ed-primary)]"
        />

        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--ed-border)] p-0.5">
          {modeOptions.map((option) => {
            const active = kind === "html" ? htmlMode === option.id : mode === option.id;
            return (
              <ModeButton
                key={option.id}
                active={active}
                onClick={() => {
                  if (kind === "html") setHtmlMode(option.id as "preview" | "split");
                  else setMode(option.id as EditorMode);
                }}
                icon={option.icon}
                label={option.label}
              />
            );
          })}
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
          {t("还原")}
        </button>

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
        >
          <RotateCcw className="size-3.5" />
          {t("退出编辑")}
        </button>

        <button
          type="button"
          onClick={save}
          disabled={!unsaved && !saved}
          title="保存到本地草稿（不联网）；切换页面后仍可继续查看"
          className="flex items-center gap-1.5 rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {justSaved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          {justSaved ? t("已保存") : unsaved ? t("保存修改") : t("已保存")}
        </button>
      </div>

      <p className="text-[11px] text-[var(--ed-text-subtle)]">
        {saved
          ? t("已保存到本地草稿（{time}）· 共 {count} 项待提交", {
              time: new Date(saved.savedAt).toLocaleTimeString(language, {
                hour: "2-digit",
                minute: "2-digit",
              }),
              count: drafts.length,
            })
          : unsaved
            ? t("有未保存的修改 · 点「保存修改」写入本地草稿")
            : t("与线上内容一致")}
        {" · "}
        {t("保存后可自由切换页面预览，确认无误再在顶部工具条「一键提交」。")}
      </p>

      {kind === "markdown" ? (
        mode === "wysiwyg" ? (
          <WysiwygEditor html={wysiwygHtml} onChange={setContent} />
        ) : (
          <MarkdownWorkspace
            value={content}
            onChange={setContent}
            docPath={docPath}
            branch={branch}
            mode={mode}
            onModeChange={(next) => setMode(next)}
            onSave={save}
          />
        )
      ) : (
        <HtmlWorkspace
          value={content}
          onChange={setContent}
          mode={htmlMode}
          title={docTitle}
        />
      )}

      <p className="text-[11px] text-[var(--ed-text-subtle)]">
        {t("预览与正式页面使用同一渲染管线。")}
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

