import { useEffect, useState } from "react";
import { AppWindow, Copy, Link2, ListTree, PencilLine, Share2 } from "lucide-react";
import {
  ContextMenu,
  copyText,
  useToast,
  type ContextMenuState,
} from "~/components/ui/context-menu";

export interface DocContextMenuProps {
  /** 文档标题，用于 Markdown 链接模板 */
  title: string;
  /** 绝对 URL（含域名） */
  url: string;
  /** 标题列表（用于“复制本文大纲”） */
  headings?: Array<{ text: string; id: string; depth: number }>;
  onEdit?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * 正文右键菜单
 *
 * 在文档内容区右键时提供：复制链接、复制 Markdown 链接、复制带有 HTML 结构的
 * Markdown、复制本文大纲、编辑此页。
 * 在 <a> / <img> / 标题上右键时会相应调整菜单项。
 */
export function DocContextMenu({
  title,
  url,
  headings = [],
  onEdit,
  children,
  className,
}: DocContextMenuProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const handleContextMenu = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    // 输入框 / 选中文本 / 可编辑区域：保留浏览器默认菜单（复制、搜索等）
    if (target.closest("textarea, input, [contenteditable='true']")) return;
    const selection = window.getSelection();
    if (selection && selection.type === "Range" && selection.toString().trim()) return;
    if (target.closest("img")) return;

    const link = target.closest("a");
    const heading = target.closest("h1, h2, h3, h4, h5, h6");

    if (link) {
      const href = link.getAttribute("href") ?? "";
      const absolute = href.startsWith("#") ? `${url}${href}` : new URL(href, url).toString();
      const text = link.textContent?.trim() ?? "";
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        title: text || absolute,
        items: [
          {
            id: "open-new",
            label: "在新标签页打开",
            icon: <AppWindow className="size-3.5" />,
            onSelect: () => window.open(absolute, "_blank", "noopener"),
          },
          {
            id: "copy-link",
            label: "复制链接",
            icon: <Share2 className="size-3.5" />,
            separated: true,
            onSelect: async () => toast.show((await copyText(absolute)) ? "链接已复制" : "复制失败"),
          },
          {
            id: "copy-md",
            label: "复制为 Markdown 链接",
            icon: <Link2 className="size-3.5" />,
            onSelect: async () =>
              toast.show(
                (await copyText(`[${text}](${absolute})`)) ? "Markdown 链接已复制" : "复制失败",
              ),
          },
        ],
      });
      return;
    }

    if (heading) {
      const id = heading.id;
      const anchorUrl = id ? `${url}#${id}` : url;
      const text = heading.textContent?.replace(/#$/, "").trim() ?? "";
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        title: text,
        items: [
          {
            id: "copy-anchor",
            label: "复制此标题的链接",
            icon: <Link2 className="size-3.5" />,
            onSelect: async () =>
              toast.show((await copyText(anchorUrl)) ? "标题链接已复制" : "复制失败"),
          },
          {
            id: "copy-anchor-md",
            label: "复制为 Markdown 链接",
            icon: <Share2 className="size-3.5" />,
            onSelect: async () =>
              toast.show(
                (await copyText(`[${text}](${anchorUrl})`)) ? "Markdown 链接已复制" : "复制失败",
              ),
          },
        ],
      });
      return;
    }

    event.preventDefault();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      title,
      items: [
        {
          id: "copy-doc",
          label: "复制本页链接",
          icon: <Copy className="size-3.5" />,
          onSelect: async () => toast.show((await copyText(url)) ? "链接已复制" : "复制失败"),
        },
        {
          id: "copy-doc-md",
          label: "复制为 Markdown 链接",
          icon: <Link2 className="size-3.5" />,
          onSelect: async () =>
            toast.show((await copyText(`[${title}](${url})`)) ? "Markdown 链接已复制" : "复制失败"),
        },
        {
          id: "copy-toc",
          label: "复制本文大纲",
          icon: <ListTree className="size-3.5" />,
          separated: true,
          disabled: headings.length === 0,
          hidden: headings.length === 0,
          onSelect: async () => {
            const outline = headings
              .map((heading) => `${"  ".repeat(Math.max(heading.depth - 1, 0))}- [${heading.text}](${url}#${heading.id})`)
              .join("\n");
            toast.show((await copyText(outline)) ? "大纲已复制" : "复制失败");
          },
        },
        {
          id: "edit",
          label: "编辑此页",
          icon: <PencilLine className="size-3.5" />,
          separated: true,
          hidden: !onEdit,
          onSelect: () => onEdit?.(),
        },
      ],
    });
  };

  return (
    <div className={className} onContextMenu={handleContextMenu}>
      {children}
      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      {toast.node}
    </div>
  );
}
