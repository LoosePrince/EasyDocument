import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSite } from "~/components/providers/config-provider";
import { useEditorContext } from "~/lib/editor/editor-store";
import { ContextMenu, copyText, menuIcons, useToast, type ContextMenuState } from "~/components/ui/context-menu";
import { cn } from "~/lib/utils";

export interface SidebarTreeProps {
  tree: DocsNode;
  branch: string;
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
export function SidebarTree({ tree, branch, activePath, onNavigate, onOpenDoc }: SidebarTreeProps) {
  const { config } = useSite();
  const location = useLocation();
  const navigate = useNavigate();
  const editor = useEditorContext();
  const toast = useToast();

  const effectiveTree = useMemo(() => editor.previewTree(tree), [editor, tree]);

  const [expanded, setExpanded] = useState<FolderState>(() =>
    computeInitialExpansion(effectiveTree, config.navigation.folder_expand_mode, activePath),
  );
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ parent: string; kind: "doc" | "folder" } | null>(null);

  useEffect(() => {
    if (!activePath) return;
    setExpanded((current) => ({ ...current, ...expandAncestors(effectiveTree, activePath) }));
  }, [activePath, effectiveTree]);

  const toggle = useCallback((path: string) => {
    setExpanded((current) => ({ ...current, [path]: !current[path] }));
  }, []);

  const expandAll = () => setExpanded(collectFolders(effectiveTree));
  const collapseAll = () => setExpanded({});

  /** 重命名 / 新建：都落到草稿 */
  const renameNode = (node: DocsNode, nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title || title === node.title) return;
    const target = node.index?.path ?? node.path;
    editor.saveDraft({
      path: target,
      branch,
      kind: "update",
      title,
      format: target.endsWith(".html") ? "html" : "md",
    });
    toast.show(`已重命名为「${title}」（提交后生效）`);
  };

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
      toast.show("该路径已在待提交列表中");
      return;
    }

    editor.saveDraft({
      path: fullPath,
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
      toast.show(`已新建目录「${title}」（含 README.md）`);
    }
  };

  const deleteNode = (node: DocsNode) => {
    const target = node.index?.path ?? node.path;
    if (!target) return;
    const draft = editor.getDraft(target);
    if (draft?.kind === "create") {
      editor.removeDraft(target);
      toast.show("已从待提交列表移除");
      return;
    }
    editor.saveDraft({
      path: target,
      branch,
      kind: "delete",
      title: node.title,
    });
    toast.show(`已标记删除「${node.title}」（提交后生效）`);
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
        ? new URL(docUrlPath({ branch, path: stripExtension(node.index?.path ?? node.path) }), window.location.origin).toString()
        : "";

    setMenu({
      x: event.clientX,
      y: event.clientY,
      title: node.title,
      items: [
        {
          id: "open",
          label: isFolder && !node.index ? "展开/折叠" : "打开",
          icon: menuIcons.open,
          disabled: !target,
          onSelect: () => {
            if (isFolder && !node.index) toggle(node.path);
            else if (target) navigate(docUrlPath({ branch, path: stripExtension(target) }));
          },
        },
        {
          id: "copy-url",
          label: "复制链接",
          icon: menuIcons.copy,
          hidden: !target,
          onSelect: async () => {
            const ok = await copyText(absoluteUrl);
            toast.show(ok ? "链接已复制" : "复制失败");
          },
        },
        {
          id: "copy-md",
          label: "复制为 Markdown 链接",
          icon: menuIcons.markdown,
          hidden: !target,
          onSelect: async () => {
            const ok = await copyText(`[${node.title}](${absoluteUrl})`);
            toast.show(ok ? "Markdown 链接已复制" : "复制失败");
          },
        },
        {
          id: "new-doc",
          label: "在此新建文档",
          icon: menuIcons.newDoc,
          separated: true,
          hidden: !editor.canEdit,
          onSelect: () => setCreating({ parent: isFolder ? node.path : parentOf(node.path), kind: "doc" }),
        },
        {
          id: "new-folder",
          label: "在此新建文件夹",
          icon: menuIcons.newFolder,
          hidden: !editor.canEdit || !isFolder,
          onSelect: () => setCreating({ parent: node.path, kind: "folder" }),
        },
        {
          id: "rename",
          label: isFolder ? "重命名目录" : "重命名",
          icon: menuIcons.rename,
          separated: true,
          disabled: !target,
          hidden: !editor.canEdit || options.isRoot,
          onSelect: () => setRenaming(node.path),
        },
        {
          id: "delete",
          label: isFolder ? "删除目录（含 README）" : "删除文档",
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
            placeholder="筛选目录…"
            aria-label="筛选目录"
            className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-1.5 pl-7 pr-6 text-xs outline-none focus:border-[var(--ed-primary)]"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="清除筛选"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--ed-text-subtle)] hover:text-[var(--ed-text)]"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={expandAll}
          title="全部展开"
          aria-label="全部展开"
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
        >
          <ChevronsUpDown className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={collapseAll}
          title="全部折叠"
          aria-label="全部折叠"
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--ed-text-subtle)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
        >
          <ChevronsDownUp className="size-3.5" />
        </button>
        {editor.canEdit ? (
          <button
            type="button"
            onClick={() => setCreating({ parent: "", kind: "doc" })}
            title="新建文档"
            aria-label="新建文档"
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

      <nav aria-label="文档导航" className="min-h-0 flex-1 overflow-y-auto text-sm">
        <ul className="space-y-0.5">
          {displayTree.index && displayTree.path === "" ? (
            <li>
              <TreeLink
                to={docUrlPath({ branch, path: "" })}
                title={displayTree.index.title}
                active={isActive(location.pathname, branch, displayTree.index.path, config)}
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
            />
          ))}
        </ul>

        {displayTree.children.length === 0 && !displayTree.index ? (
          <p className="px-1 py-4 text-xs text-[var(--ed-text-subtle)]">
            {filter ? "没有匹配的条目" : "此版本还没有文档。"}
            {editor.canEdit && !filter ? (
              <button
                type="button"
                onClick={() => setCreating({ parent: "", kind: "doc" })}
                className="mt-2 block text-[var(--ed-primary)] hover:underline"
              >
                新建第一篇文档
              </button>
            ) : null}
          </p>
        ) : null}
      </nav>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      {toast.node}
    </div>
  );
}

interface TreeItemProps {
  node: DocsNode;
  branch: string;
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
}

function TreeItem({
  node,
  branch,
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
}: TreeItemProps) {
  const { config } = useSite();
  const location = useLocation();
  const editor = useEditorContext();
  const isFolder = node.children.length > 0 || Boolean(node.index);
  const open = expanded[node.path] ?? false;
  const draft = editor.getDraft(node.index?.path ?? node.path);
  const isRenaming = renaming === node.path;

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
      <li>
        <TreeLink
          to={docUrlPath({ branch, path: stripExtension(node.path) })}
          title={node.title}
          active={isActive(location.pathname, branch, node.path, config)}
          depth={depth}
          onNavigate={onNavigate}
          onContextMenu={(event) => onContextMenu(event, node)}
          icon={<FileText className="size-3.5 shrink-0 opacity-50" />}
          draftState={draft?.kind}
        />
      </li>
    );
  }

  const folderHref = node.index
    ? docUrlPath({ branch, path: stripExtension(node.index.path) })
    : undefined;

  return (
    <li>
      <div className="group flex items-center">
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="grid size-6 shrink-0 place-items-center rounded text-[var(--ed-text-subtle)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
          aria-expanded={open}
          aria-label={open ? `折叠 ${node.title}` : `展开 ${node.title}`}
          style={{ marginLeft: `${depth * 0.75}rem` }}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        </button>

        {folderHref ? (
          <Link
            to={folderHref}
            onClick={onNavigate}
            onContextMenu={(event) => onContextMenu(event, node)}
            onDoubleClick={() => editor.canEdit && onRenameStart(node.path)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors",
              isActive(location.pathname, branch, node.index!.path, config)
                ? "bg-[var(--ed-primary-soft)] font-medium text-[var(--ed-primary)]"
                : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]",
            )}
          >
            {open ? (
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
            title="分组目录（无索引页）"
          >
            {open ? (
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
  if (!kind) return null;
  const meta = {
    create: { text: "新增", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    update: { text: "修改", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    delete: { text: "删除", className: "bg-red-500/15 text-red-500" },
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
): boolean {
  const route = docUrlPath({
    branch,
    path: stripExtension(docPath).replace(
      new RegExp(
        `/(?:${config.document.index_pages.map((name) => stripExtension(name)).join("|")})$`,
        "i",
      ),
      "",
    ),
  });
  const base = config.site.base_url === "/" ? "" : config.site.base_url;
  return pathname === `${base}${route}` || pathname === `${base}${route}/`;
}
