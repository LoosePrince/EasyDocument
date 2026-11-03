import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { DocsNode } from "~/lib/content/types";
import { stripExtension } from "~/lib/content/types";
import { docUrlPath } from "~/lib/content/routes";
import { toSourcePath } from "~/lib/content/language";
import { serializePathConfig, reorderSiblings } from "~/lib/content/path-config";
import { useSite } from "~/components/providers/config-provider";
import { useI18n } from "~/lib/i18n/provider";
import { useEditorContext } from "~/lib/editor/editor-store";
import { ContextMenu, copyText, menuIcons, useToast, type ContextMenuState } from "~/components/ui/context-menu";
import { Icon } from "~/components/ui/icon";
import { IconPicker } from "~/components/ui/icon-picker";
import { cn } from "~/lib/utils";

export interface SidebarTreeProps {
  tree: DocsNode;
  branch: string;
  /** 当前文档语言（用于生成带语言段的链接与新建文件路径） */
  language?: string;
  activePath?: string;
  onNavigate?: () => void;
  onOpenDoc?: (path: string) => void;
}

type FolderState = Record<string, boolean>;

/**
 * 侧栏文档树
 *
 * 浏览态：折叠展开（folder_expand_mode）、高亮、搜索过滤
 * 编辑态：新建文档/文件夹、就地重命名、删除、右键菜单快捷操作
 */
export function SidebarTree({ tree, branch, language, activePath, onNavigate, onOpenDoc }: SidebarTreeProps) {
  const { config } = useSite();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const editor = useEditorContext();
  const toast = useToast();
  const navRef = useRef<HTMLElement | null>(null);
  /** 文档语言由页面数据传入；站点语言来自当前 UI */
  const documentLanguage = language;

  const effectiveTree = useMemo(() => editor.previewTree(tree, branch), [editor, tree, branch]);

  const [expanded, setExpanded] = useState<FolderState>(() =>
    computeInitialExpansion(effectiveTree, config.navigation.folder_expand_mode, activePath),
  );
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ parent: string; kind: "doc" | "folder" } | null>(null);
  const [iconTarget, setIconTarget] = useState<DocsNode | null>(null);

  useEffect(() => {
    if (!activePath) return;
    setExpanded((current) => ({ ...current, ...expandAncestors(effectiveTree, activePath) }));
  }, [activePath, effectiveTree]);

  // 非点击跳转（搜索 / 上一篇 / 直链 / 版本切换）后，把当前项滚进可视区域
  useEffect(() => {
    if (!activePath) return;
    const frame = requestAnimationFrame(() => {
      const element = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
      element?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePath, effectiveTree, location.pathname]);

  const toggle = useCallback((path: string) => {
    setExpanded((current) => ({ ...current, [path]: !current[path] }));
  }, []);

  const expandAll = () => setExpanded(collectFolders(effectiveTree));
  const collapseAll = () => setExpanded({});

  /**
   * 目录配置草稿
   *
   * 显示名、排序、隐藏都写进该版本的 path.json 草稿；
   * 与正文草稿一起在顶部工具条「一键提交」。
   */
  const pathConfigPath = `${branch}/${config.document.path_config || "path.json"}`;

  const readPathConfigDraft = useCallback((): Record<string, unknown> => {
    const serializeOptions = {
      localizeLanguage: language,
      defaultLanguage: config.i18n.default_document_language,
    };
    const draft = editor.getPathConfig(branch);
    if (!draft) return serializePathConfig(effectiveTree, serializeOptions) as Record<string, unknown>;
    try {
      return JSON.parse(draft.content) as Record<string, unknown>;
    } catch {
      return serializePathConfig(effectiveTree, serializeOptions) as Record<string, unknown>;
    }
  }, [branch, editor, effectiveTree, language, config.i18n.default_document_language]);

  const writePathConfigDraft = useCallback(
    (next: Record<string, unknown>) => {
      editor.savePathConfig({
        path: pathConfigPath,
        branch,
        content: `${JSON.stringify(next, null, 2)}\n`,
      });
    },
    [branch, editor, pathConfigPath],
  );

  /** 重命名：只改显示名，物理文件名保持稳定 */
  const renameNode = (node: DocsNode, nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title || title === node.title) return;

    const configJson = readPathConfigDraft();
    const targetPath = node.path || node.index?.path || "";
    const updated = upsertPathEntry(
      configJson,
      targetPath,
      { title },
      language,
      config.i18n.default_document_language,
    );
    writePathConfigDraft(updated);
    toast.show(t("显示名已改为「{title}」（提交后生效，文件名不变）", { title }));
  };

  /** 设置目录 / 文档图标（图标 id 或链接） */
  const setNodeIcon = (node: DocsNode, icon: string) => {
    const configJson = readPathConfigDraft();
    const targetPath = node.path || node.index?.path || "";
    const updated = upsertPathEntry(
      configJson,
      targetPath,
      { icon },
      language,
      config.i18n.default_document_language,
    );
    writePathConfigDraft(updated);
    toast.show(icon ? t("图标已更新（提交后生效）") : t("图标已清除（提交后生效）"));
  };

  /** 拖拽排序：写回 path.json 的 children 顺序 */
  const reorder = useCallback(
    (fromPath: string, toPath: string, position: "before" | "after") => {
      const tree = effectiveTree;
      const siblings = findSiblings(tree, toPath);
      if (!siblings) return;
      if (!siblings.some((item) => sameNode(item, fromPath))) return;

      const ordered = reorderSiblings(
        siblings.map((item) => ({ path: item.index?.path ?? item.path, node: item })),
        fromPath,
        toPath,
        position,
      );

      const configJson = readPathConfigDraft();
      const updated = setChildrenOrder(
        configJson,
        siblings.map((item) => ({ path: item.index?.path ?? item.path, title: item.title })),
        ordered.map((item) => item.path),
      );
      writePathConfigDraft(updated);
      toast.show(t("顺序已更新（提交后生效）"));
    },
    [effectiveTree, readPathConfigDraft, writePathConfigDraft, toast, t],
  );

  const createIn = (parentPath: string, kind: "doc" | "folder", name: string) => {
    const clean = name.trim().replace(/^\/+|\/+$/g, "");
    if (!clean) return;
    const base = parentPath ? `${parentPath}/` : "";
    const fullPath =
      kind === "doc"
        ? `${base}${clean.replace(/\.(md|html)$/i, "")}${clean.match(/\.html$/i) ? "" : ".md"}`
        : `${base}${clean}/README.md`;
    const title = clean.replace(/\.(md|html)$/i, "");

    if (editor.getDraft(fullPath)) {
      toast.show(t("该路径已在待提交列表中"));
      return;
    }

    editor.saveDraft({
      path: fullPath,
      sourcePath: toSourcePath(fullPath, language ?? config.i18n.default_language, config.i18n),
      branch,
      kind: "create",
      content:
        kind === "doc"
          ? `# ${title}\n\n在这里开始编写内容。\n`
          : `# ${title}\n\n${title} 目录索引。\n`,
      title,
      format: fullPath.endsWith(".html") ? "html" : "md",
    });
    setExpanded((current) => ({ ...current, [parentPath]: true }));
    if (kind === "doc") {
      onOpenDoc?.(fullPath);
    } else {
      toast.show(t("已新建目录「{title}」（含 README.md）", { title }));
    }
  };

  const deleteNode = (node: DocsNode) => {
    const target = node.index?.path ?? node.path;
    if (!target) return;
    const draft = editor.getDraft(target);
    if (draft?.kind === "create") {
      editor.removeDraft(target);
      toast.show(t("已从待提交列表移除"));
      return;
    }
    editor.saveDraft({
      path: target,
      sourcePath: node.index?.sourcePath ?? node.sourcePath ?? target,
      branch,
      kind: "delete",
      title: node.title,
    });
    toast.show(t("已标记删除「{title}」（提交后生效）", { title: node.title }));
  };

  const openMenu = (
    event: React.MouseEvent,
    node: DocsNode,
    options: { isRoot?: boolean } = {},
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const target = node.index?.path ?? node.path;
    const isFolder = node.children.length > 0 || Boolean(node.index);
    const absoluteUrl =
      typeof window !== "undefined"
        ? new URL(docUrlPath({ branch, documentLanguage, path: stripExtension(node.index?.path ?? node.path) }), window.location.origin).toString()
        : "";

    setMenu({
      x: event.clientX,
      y: event.clientY,
      title: node.title,
      items: [
        {
          id: "open",
          label: isFolder && !node.index ? t("展开折叠") : t("打开"),
          icon: menuIcons.open,
          disabled: !target,
          onSelect: () => {
            if (isFolder && !node.index) toggle(node.path);
            else if (target) navigate(docUrlPath({ branch, documentLanguage, path: stripExtension(target) }));
          },
        },
        {
          id: "copy-url",
          label: t("复制链接"),
          icon: menuIcons.copy,
          hidden: !target,
          onSelect: async () => {
            const ok = await copyText(absoluteUrl);
            toast.show(ok ? t("链接已复制") : t("复制失败"));
          },
        },
        {
          id: "copy-md",
          label: t("复制为 Markdown 链接"),
          icon: menuIcons.markdown,
          hidden: !target,
          onSelect: async () => {
            const ok = await copyText(`[${node.title}](${absoluteUrl})`);
            toast.show(ok ? t("Markdown 链接已复制") : t("复制失败"));
          },
        },
        {
          id: "new-doc",
          label: t("在此新建文档"),
          icon: menuIcons.newDoc,
          separated: true,
          hidden: !editor.canEdit,
          onSelect: () => setCreating({ parent: isFolder ? node.path : parentOf(node.path), kind: "doc" }),
        },
        {
          id: "new-folder",
          label: t("在此新建文件夹"),
          icon: menuIcons.newFolder,
          hidden: !editor.canEdit || !isFolder,
          onSelect: () => setCreating({ parent: node.path, kind: "folder" }),
        },
        {
          id: "rename",
          label: isFolder ? t("重命名目录") : t("重命名"),
          icon: menuIcons.rename,
          separated: true,
          disabled: !target,
          hidden: !editor.canEdit || options.isRoot,
          onSelect: () => setRenaming(node.path),
        },
        {
          id: "icon",
          label: t("设置图标"),
          icon: <Icon name={node.icon ?? node.index?.icon ?? "sparkles"} className="size-3.5" />,
          disabled: !target,
          hidden: !editor.canEdit || options.isRoot,
          onSelect: () => setIconTarget(node),
        },
        {
          id: "delete",
          label: isFolder ? t("删除目录（含 README）") : t("删除文档"),
          icon: menuIcons.delete,
          danger: true,
          disabled: !target,
          hidden: !editor.canEdit || options.isRoot,
          onSelect: () => deleteNode(node),
        },
      ],
    });
  };

  const filtered = useMemo(() => (filter.trim() ? filterTree(effectiveTree, filter.trim()) : null), [effectiveTree, filter]);
  const displayTree = filtered ?? effectiveTree;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {/* 搜索 + 快捷操作 */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ed-text-subtle)]" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t("筛选目录…")}
            aria-label={t("筛选目录")}
            className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-1.5 pl-7 pr-6 text-xs outline-none focus:border-[var(--ed-primary)]"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label={t("清除筛选")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--ed-text-subtle)] hover:text-[var(--ed-text)]"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={expandAll}
          title={t("全部展开")}
          aria-label={t("全部展开")}
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
        >
          <ChevronsUpDown className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={collapseAll}
          title={t("全部折叠")}
          aria-label={t("全部折叠")}
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
        >
          <ChevronsDownUp className="size-3.5" />
        </button>
        {editor.canEdit ? (
          <button
            type="button"
            onClick={() => setCreating({ parent: "", kind: "doc" })}
            title={t("新建文档")}
            aria-label={t("新建文档")}
            className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-primary)]"
          >
            <Plus className="size-4" />
          </button>
        ) : null}
      </div>

      {/* 新建输入 */}
      {creating ? (
        <InlineCreate
          kind={creating.kind}
          onCancel={() => setCreating(null)}
          onSubmit={(name) => {
            createIn(creating.parent, creating.kind, name);
            setCreating(null);
          }}
        />
      ) : null}

      <nav ref={navRef} aria-label={t("文档导航")} className="min-h-0 flex-1 overflow-y-auto text-sm">
        <ul className="space-y-0.5">
          {displayTree.index && displayTree.path === "" ? (
            <li>
              <TreeLink
                to={docUrlPath({ branch, path: "", documentLanguage })}
                title={displayTree.index.title}
                active={isActive(location.pathname, branch, displayTree.index.path, config, documentLanguage)}
                depth={0}
                onNavigate={onNavigate}
                onContextMenu={(event) => openMenu(event, displayTree, { isRoot: true })}
                draftState={editor.getDraft(displayTree.index.path)?.kind}
              />
            </li>
          ) : null}

          {displayTree.children.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              branch={branch}
              language={documentLanguage}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              activePath={activePath}
              onNavigate={onNavigate}
              onContextMenu={openMenu}
              renaming={renaming}
              onRenameStart={setRenaming}
              onRenameSubmit={renameNode}
              onRenameCancel={() => setRenaming(null)}
              onReorder={reorder}
            />
          ))}
        </ul>

        {displayTree.children.length === 0 && !displayTree.index ? (
          <p className="px-1 py-4 text-xs text-[var(--ed-text-subtle)]">
            {filter ? t("没有匹配的条目") : t("此版本还没有文档。")}
            {editor.canEdit && !filter ? (
              <button
                type="button"
                onClick={() => setCreating({ parent: "", kind: "doc" })}
                className="mt-2 block text-[var(--ed-primary)] hover:underline"
              >
                {t("新建第一篇文档")}
              </button>
            ) : null}
          </p>
        ) : null}
      </nav>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      <IconPicker
        open={iconTarget !== null}
        value={iconTarget ? (iconTarget.icon ?? iconTarget.index?.icon ?? "") : ""}
        title={t("设置图标")}
        onClose={() => setIconTarget(null)}
        onSelect={(value) => {
          if (iconTarget) setNodeIcon(iconTarget, value);
          setIconTarget(null);
        }}
      />
      {toast.node}
    </div>
  );
}

interface TreeItemProps {
  node: DocsNode;
  branch: string;
  language?: string;
  depth: number;
  expanded: FolderState;
  onToggle: (path: string) => void;
  activePath?: string;
  onNavigate?: () => void;
  onContextMenu: (event: React.MouseEvent, node: DocsNode) => void;
  renaming: string | null;
  onRenameStart: (path: string) => void;
  onRenameSubmit: (node: DocsNode, title: string) => void;
  onRenameCancel: () => void;
  onReorder: (fromPath: string, toPath: string, position: "before" | "after") => void;
}

function TreeItem({
  node,
  branch,
  language,
  depth,
  expanded,
  onToggle,
  activePath,
  onNavigate,
  onContextMenu,
  renaming,
  onRenameStart,
  onRenameSubmit,
  onRenameCancel,
  onReorder,
}: TreeItemProps) {
  const { config } = useSite();
  const { t } = useI18n();
  const location = useLocation();
  const editor = useEditorContext();
  const isFolder = node.children.length > 0 || Boolean(node.index);
  const open = expanded[node.path] ?? false;
  const draft = editor.getDraft(node.index?.path ?? node.path);
  const isRenaming = renaming === node.path;
  const [dragOver, setDragOver] = useState<"before" | "after" | null>(null);
  const nodeKey = node.index?.path ?? node.path;

  /** 拖拽排序（仅编辑模式；同父级内有效） */
  const dragProps = editor.canEdit
    ? {
        draggable: true,
        onDragStart: (event: React.DragEvent) => {
          event.dataTransfer.setData("text/plain", nodeKey);
          event.dataTransfer.effectAllowed = "move";
        },
        onDragOver: (event: React.DragEvent) => {
          if (!event.dataTransfer.types.includes("text/plain")) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setDragOver(event.clientY < rect.top + rect.height / 2 ? "before" : "after");
        },
        onDragLeave: () => setDragOver(null),
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          const from = event.dataTransfer.getData("text/plain");
          setDragOver(null);
          if (!from || from === nodeKey) return;
          onReorder(from, nodeKey, dragOver ?? "before");
        },
        onDragEnd: () => setDragOver(null),
      }
    : {};

  const dropClass =
    dragOver === "before"
      ? "before:absolute before:-top-px before:left-0 before:right-0 before:h-0.5 before:bg-[var(--ed-primary)]"
      : dragOver === "after"
        ? "after:absolute after:-bottom-px after:left-0 after:right-0 after:h-0.5 after:bg-[var(--ed-primary)]"
        : "";

  if (isRenaming) {
    return (
      <li>
        <InlineRename
          initial={node.title}
          depth={depth}
          onCancel={onRenameCancel}
          onSubmit={(value) => onRenameSubmit(node, value)}
        />
      </li>
    );
  }

  if (!isFolder) {
    return (
      <li className={cn("relative", dropClass)} {...dragProps}>
        <TreeLink
          to={docUrlPath({ branch, documentLanguage: language, path: stripExtension(node.path) })}
          title={node.title}
          active={isActive(location.pathname, branch, node.path, config, language)}
          depth={depth}
          onNavigate={onNavigate}
          onContextMenu={(event) => onContextMenu(event, node)}
          icon={
            node.icon ? (
              <Icon name={node.icon} className="size-3.5 shrink-0 opacity-80" />
            ) : (
              <FileText className="size-3.5 shrink-0 opacity-50" />
            )
          }
          draftState={draft?.kind}
        />
      </li>
    );
  }

  const folderHref = node.index
    ? docUrlPath({ branch, documentLanguage: language, path: stripExtension(node.index.path) })
    : undefined;

  return (
    <li className={cn("relative", dropClass)} {...dragProps}>
      <div className="group flex items-center">
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="grid size-6 shrink-0 place-items-center rounded text-[var(--ed-text-subtle)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
            aria-expanded={open}
            aria-label={open ? `${t("折叠")} ${node.title}` : `${t("展开")} ${node.title}`}
            style={{ marginLeft: `${depth * 0.75}rem` }}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          // 只有 README.md 的目录：没有可展开内容，不显示展开/折叠按钮
          <span
            className="size-6 shrink-0"
            style={{ marginLeft: `${depth * 0.75}rem` }}
            aria-hidden="true"
          />
        )}

        {folderHref ? (
          <Link
            to={folderHref}
            onClick={onNavigate}
            onContextMenu={(event) => onContextMenu(event, node)}
            onDoubleClick={() => editor.canEdit && onRenameStart(node.path)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors",
              isActive(location.pathname, branch, node.index!.path, config, language)
                ? "bg-[var(--ed-primary-soft)] font-medium text-[var(--ed-primary)]"
                : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]",
            )}
            aria-current={
              isActive(location.pathname, branch, node.index!.path, config, language)
                ? "page"
                : undefined
            }
          >
            {node.icon ? (
              <Icon name={node.icon} className="size-3.5 shrink-0 opacity-80" />
            ) : open ? (
              <FolderOpen className="size-3.5 shrink-0 opacity-60" />
            ) : (
              <Folder className="size-3.5 shrink-0 opacity-60" />
            )}
            <span className="truncate">{node.title}</span>
            <DraftBadge kind={draft?.kind} />
          </Link>
        ) : (
          // 没有索引页的目录只作分组：点击只展开/折叠，不跳转（避免 404）
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            onContextMenu={(event) => onContextMenu(event, node)}
            onDoubleClick={() => editor.canEdit && onRenameStart(node.path)}
            className="flex min-w-0 flex-1 cursor-default items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[var(--ed-text-subtle)] transition-colors hover:bg-[var(--ed-bg-subtle)]"
            title={t("分组目录（无索引页）")}
          >
            {node.icon ? (
              <Icon name={node.icon} className="size-3.5 shrink-0 opacity-80" />
            ) : open ? (
              <FolderOpen className="size-3.5 shrink-0 opacity-60" />
            ) : (
              <Folder className="size-3.5 shrink-0 opacity-60" />
            )}
            <span className="truncate">{node.title}</span>
            <DraftBadge kind={draft?.kind} />
          </button>
        )}
      </div>

      {open && node.children.length > 0 ? (
        <ul className="mt-0.5 space-y-0.5 border-l border-[var(--ed-border)] pl-1">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              branch={branch}
              language={language}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              activePath={activePath}
              onNavigate={onNavigate}
              onContextMenu={onContextMenu}
              renaming={renaming}
              onRenameStart={onRenameStart}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onReorder={onReorder}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeLink({
  to,
  title,
  active,
  depth,
  icon,
  onNavigate,
  onContextMenu,
  draftState,
}: {
  to: string;
  title: string;
  active: boolean;
  depth: number;
  icon?: React.ReactNode;
  onNavigate?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  draftState?: "update" | "create" | "delete";
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      onContextMenu={onContextMenu}
      className={cn(
        "flex items-center gap-1.5 rounded-md py-1.5 pr-1.5 transition-colors",
        active
          ? "bg-[var(--ed-primary-soft)] font-medium text-[var(--ed-primary)]"
          : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]",
      )}
      style={{ paddingLeft: `${depth * 0.75 + 0.375}rem` }}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="truncate">{title}</span>
      <DraftBadge kind={draftState} />
    </Link>
  );
}

function DraftBadge({ kind }: { kind?: "update" | "create" | "delete" }) {
  const { t } = useI18n();
  if (!kind) return null;
  const meta = {
    create: { text: t("新增"), className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    update: { text: t("修改"), className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    delete: { text: t("删除"), className: "bg-red-500/15 text-red-500" },
  }[kind];

  return (
    <span className={cn("ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-medium", meta.className)}>
      {meta.text}
    </span>
  );
}

function InlineRename({
  initial,
  depth,
  onSubmit,
  onCancel,
}: {
  initial: string;
  depth: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <input
      autoFocus
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onSubmit(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit(value);
        if (event.key === "Escape") onCancel();
      }}
      aria-label="重命名"
      className="w-full rounded-md border border-[var(--ed-primary)] bg-[var(--ed-bg-elevated)] px-1.5 py-1 text-sm outline-none"
      style={{ marginLeft: `${depth * 0.75 + 1.5}rem` }}
    />
  );
}

function InlineCreate({
  kind,
  onSubmit,
  onCancel,
}: {
  kind: "doc" | "folder";
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit(value);
          if (event.key === "Escape") onCancel();
        }}
        onBlur={() => (value.trim() ? onSubmit(value) : onCancel())}
        placeholder={kind === "doc" ? "新文档名，如 新章节.md" : "新文件夹名"}
        aria-label={kind === "doc" ? "新文档名" : "新文件夹名"}
        className="flex-1 rounded-md border border-[var(--ed-primary)] bg-[var(--ed-bg-elevated)] px-2 py-1 text-xs outline-none"
      />
      <button
        type="button"
        onClick={onCancel}
        className="text-[var(--ed-text-subtle)] hover:text-[var(--ed-text)]"
        aria-label="取消"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** 两个树节点是否指同一个条目（索引页与目录视为同一项） */
function sameNode(node: DocsNode, path: string): boolean {
  return node.path === path || node.index?.path === path;
}

/** 找到与目标路径同级的兄弟节点（含目标自身） */
function findSiblings(tree: DocsNode, targetPath: string): DocsNode[] | null {
  if (tree.children.some((child) => sameNode(child, targetPath))) return tree.children;
  for (const child of tree.children) {
    if (child.children.length === 0 && !child.index) continue;
    const found = findSiblings(child, targetPath);
    if (found) return found;
  }
  return null;
}

/** 从路径中取目录层级 */
function dirKey(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/**
 * 在 path.json 中 upsert 一个条目（按所在目录定位 children 数组）。
 * 保持既有顺序，只更新/新增目标项。
 */
function upsertPathEntry(
  configJson: Record<string, unknown>,
  targetPath: string,
  patch: { title?: string; icon?: string },
  language?: string,
  defaultLanguage?: string,
): Record<string, unknown> {
  const key = dirKey(targetPath);
  const list = ensureChildren(configJson, key);
  const existing = list.find(
    (item) => typeof item.path === "string" && item.path === targetPath,
  ) as Record<string, unknown> | undefined;

  const localize = Boolean(language && defaultLanguage && language !== defaultLanguage);
  const applyLocalized = (entry: Record<string, unknown>) => {
    const translations =
      entry.translations && typeof entry.translations === "object"
        ? { ...(entry.translations as Record<string, unknown>) }
        : {};
    const current =
      translations[language!] && typeof translations[language!] === "object"
        ? (translations[language!] as Record<string, unknown>)
        : {};
    const next = { ...current };
    if (patch.title !== undefined) next.title = patch.title;
    if (patch.icon !== undefined) {
      if (patch.icon) next.icon = patch.icon;
      else delete next.icon;
    }
    translations[language!] = next;
    entry.translations = translations;
  };

  if (existing) {
    if (localize) {
      applyLocalized(existing);
    } else {
      if (patch.title !== undefined) existing.title = patch.title;
      if (patch.icon !== undefined) {
        if (patch.icon) existing.icon = patch.icon;
        else delete existing.icon;
      }
    }
  } else if (localize) {
    const entry: Record<string, unknown> = { path: targetPath };
    applyLocalized(entry);
    list.push(entry);
  } else {
    list.push({
      path: targetPath,
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.icon ? { icon: patch.icon } : {}),
    });
  }

  return configJson;
}

/** 按期望顺序重排某个目录下的 children（缺的补上，多出的保持在末尾） */
function setChildrenOrder(
  configJson: Record<string, unknown>,
  siblings: Array<{ path: string; title: string }>,
  order: string[],
): Record<string, unknown> {
  const first = order[0] ?? siblings[0]?.path ?? "";
  const parentKey = dirKey(first);
  const list = ensureChildren(configJson, parentKey);

  const byPath = new Map<string, Record<string, unknown>>();
  for (const item of list) {
    const path = typeof item.path === "string" ? item.path : "";
    if (path) byPath.set(path, item);
  }
  for (const sibling of siblings) {
    if (!byPath.has(sibling.path)) byPath.set(sibling.path, { path: sibling.path, title: sibling.title });
  }

  const ordered = order
    .map((path) => byPath.get(path))
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const orderedPaths = new Set(order);
  const remainder = list.filter(
    (item) => typeof item.path !== "string" || !orderedPaths.has(item.path),
  );

  list.splice(0, list.length, ...ordered, ...remainder);
  return configJson;
}

/**
 * 取得目录配置中某个目录的 children 数组（不存在则创建）。
 * `dirPath` 为空串表示顶层。
 */
function ensureChildren(
  root: Record<string, unknown>,
  dirPath: string,
): Array<Record<string, unknown>> {
  if (!root.children || !Array.isArray(root.children)) root.children = [];
  let list = root.children as Array<Record<string, unknown>>;

  if (!dirPath) return list;

  for (const segment of dirPath.split("/").filter(Boolean)) {
    let node = list.find((item) => item.path === segment || item.path === `${segment}/README.md` || item.path === `${segment}/README`) as
      | Record<string, unknown>
      | undefined;
    if (!node) {
      node = { path: segment, children: [] };
      list.push(node);
    }
    if (!Array.isArray(node.children)) node.children = [];
    list = node.children as Array<Record<string, unknown>>;
  }

  return list;
}

function parentOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/** 按 folder_expand_mode 计算初始展开集合 */
export function computeInitialExpansion(
  tree: DocsNode,
  mode: number,
  activePath?: string,
): FolderState {
  const state: FolderState = {};

  switch (mode) {
    case 1:
      for (const node of tree.children) {
        if (node.children.length > 0) state[node.path] = true;
      }
      break;
    case 2:
      Object.assign(state, collectFolders(tree));
      break;
    case 3: {
      const first = tree.children.find((node) => node.children.length > 0);
      if (first) {
        state[first.path] = true;
        for (const child of first.children) {
          if (child.children.length > 0) state[child.path] = true;
        }
      }
      break;
    }
    case 4: {
      const first = tree.children.find((node) => node.children.length > 0);
      if (first) {
        state[first.path] = true;
        Object.assign(state, collectFolders(first));
      }
      break;
    }
    case 5:
    default:
      break;
  }

  if (activePath) Object.assign(state, expandAncestors(tree, activePath));
  return state;
}

function collectFolders(tree: DocsNode): FolderState {
  const state: FolderState = {};
  const walk = (node: DocsNode) => {
    for (const child of node.children) {
      if (child.children.length > 0) {
        state[child.path] = true;
        walk(child);
      }
    }
  };
  walk(tree);
  return state;
}

/** 找到当前文档的祖先目录集合 */
export function expandAncestors(tree: DocsNode, activePath: string): FolderState {
  const state: FolderState = {};
  const target = activePath.replace(/^\/+/, "");

  const visit = (node: DocsNode, ancestors: string[]): boolean => {
    if (node.index?.path === target || node.path === target) {
      for (const ancestor of ancestors) state[ancestor] = true;
      return true;
    }
    for (const child of node.children) {
      if (visit(child, node.path === "" ? ancestors : [...ancestors, node.path])) return true;
    }
    return false;
  };

  visit(tree, []);
  return state;
}

/** 目录筛选：保留命中节点及其祖先 */
function filterTree(tree: DocsNode, query: string): DocsNode {
  const lower = query.toLowerCase();

  const filterNode = (node: DocsNode): DocsNode | null => {
    const isFile = node.children.length === 0 && !node.index;
    if (isFile) {
      return node.title.toLowerCase().includes(lower) ? node : null;
    }
    const children = node.children.map(filterNode).filter((child): child is DocsNode => Boolean(child));
    const selfMatch = node.title.toLowerCase().includes(lower);
    const indexMatch = node.index?.title.toLowerCase().includes(lower) ?? false;
    if (children.length === 0 && !selfMatch && !indexMatch) return null;
    return { ...node, children };
  };

  const children = tree.children
    .map(filterNode)
    .filter((child): child is DocsNode => Boolean(child));

  return { ...tree, children };
}

function isActive(
  pathname: string,
  branch: string,
  docPath: string,
  config: { document: { index_pages: string[] }; site: { base_url: string } },
  documentLanguage?: string,
): boolean {
  const route = docUrlPath({
    branch,
    documentLanguage,
    path: stripExtension(docPath).replace(
      new RegExp(
        `/(?:${config.document.index_pages.map((name) => stripExtension(name)).join("|")})$`,
        "i",
      ),
      "",
    ),
  });
  const base = config.site.base_url === "/" ? "" : config.site.base_url;
  const target = `${base}${route}`;
  // 浏览器可能把 CJK / 空格编码进 location.pathname，比较前统一解码
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const current = decode(pathname).replace(/\/+$/, "");
  const expected = decode(target).replace(/\/+$/, "");
  return current === expected;
}
