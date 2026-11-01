import { useEffect, useRef, useState } from "react";
import { renderPreview, type PreviewRenderInput } from "~/lib/markdown/preview";
import { TableOfContents, type TocHeading } from "~/components/toc/table-of-contents";
import { useDocEnhancements, useMermaid } from "~/components/markdown/doc-enhancements";
import { cn } from "~/lib/utils";

export interface PreviewPaneProps extends Omit<PreviewRenderInput, "tocNumbering" | "tocIgnoreH1"> {
  tocNumbering?: boolean;
  tocIgnoreH1?: boolean;
  className?: string;
  emptyHint?: string;
  /** 与预览同步滚动的 textarea */
  syncScrollElement?: HTMLTextAreaElement | null;
  showOutline?: boolean;
  tocDepth?: number;
  tocDynamicExpand?: boolean;
}

/**
 * 实时预览
 *
 * 直接复用构建期渲染管线，因此与实际发布页面一致。
 * 渲染是异步的（含代码高亮），因此做了防抖与竞态保护。
 */
export function PreviewPane({
  className,
  emptyHint,
  syncScrollElement,
  showOutline = false,
  tocDepth = 3,
  tocDynamicExpand = true,
  tocNumbering = true,
  tocIgnoreH1 = true,
  ...input
}: PreviewPaneProps) {
  const [html, setHtml] = useState("");
  const [toc, setToc] = useState<TocHeading[]>([]);
  const [rendering, setRendering] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const { lightboxSrc, closeLightbox } = useDocEnhancements(contentRef, html);
  useMermaid(contentRef, input.mermaid, html);

  useEffect(() => {
    const id = ++requestId.current;
    setRendering(true);
    const timer = window.setTimeout(() => {
      void renderPreview({ ...input, tocNumbering, tocIgnoreH1 })
        .then((result) => {
          if (id !== requestId.current) return;
          setHtml(result.html);
          setToc(result.toc);
        })
        .finally(() => {
          if (id === requestId.current) setRendering(false);
        });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.markdown, input.docPath, input.branch, input.math, input.highlight, input.mermaid]);

  // 源码 → 预览滚动同步
  useEffect(() => {
    const textarea = syncScrollElement;
    const pane = paneRef.current;
    if (!textarea || !pane) return;
    const handler = () => {
      const ratio =
        textarea.scrollHeight > textarea.clientHeight
          ? textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight)
          : 0;
      pane.scrollTop = ratio * (pane.scrollHeight - pane.clientHeight);
    };
    textarea.addEventListener("scroll", handler, { passive: true });
    return () => textarea.removeEventListener("scroll", handler);
  }, [syncScrollElement]);

  return (
    <div className="flex min-h-0 gap-4">
      <div ref={paneRef} className={cn("min-w-0 flex-1", className)}>
        {input.markdown.trim() ? (
          <div
            ref={contentRef}
            className="doc-content"
            data-rendering={rendering ? "true" : "false"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-[var(--ed-text-subtle)]">{emptyHint ?? "暂无内容"}</p>
        )}
      </div>

      {showOutline && toc.length > 0 ? (
        <TableOfContents
          headings={toc}
          tocDepth={tocDepth}
          dynamicExpand={tocDynamicExpand}
          className="hidden w-52 shrink-0 overflow-y-auto pl-3 xl:block"
        />
      ) : null}

      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80"
          onClick={closeLightbox}
          role="presentation"
        >
          <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
