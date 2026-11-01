import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { DocsNode } from "~/lib/content/types";
import { stripExtension } from "~/lib/content/types";
import { docUrlPath } from "~/lib/content/routes";
import { useSite } from "~/components/providers/config-provider";
import { cn } from "~/lib/utils";

export interface SidebarTreeProps {
  tree: DocsNode;
  branch: string;
  /** 当前文档在分支内的路径（用于高亮） */
  activePath?: string;
  onNavigate?: () => void;
}

type FolderState = Record<string, boolean>;

/**
 * 侧栏文档树
 *
 * 对齐 legacy 的 `folder_expand_mode`：
 *  1 展开全部第一级文件夹
 *  2 展开全部文件夹
 *  3 展开第一个文件夹的第一级
 *  4 展开第一个文件夹的全部文件夹
 *  5 不默认展开任何文件夹
 */
export function SidebarTree({ tree, branch, activePath, onNavigate }: SidebarTreeProps) {
  const { config } = useSite();
  const location = useLocation();

  const initial = useMemo(
    () => computeInitialExpansion(tree, config.navigation.folder_expand_mode, activePath),
    // 仅在树/分支变化时重算，避免用户手动折叠后被重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree, branch],
  );

  const [expanded, setExpanded] = useState<FolderState>(initial);

  // 路由变化时展开到当前文档
  useEffect(() => {
    if (!activePath) return;
    setExpanded((current) => ({ ...current, ...expandAncestors(tree, activePath) }));
  }, [activePath, tree]);

  const toggle = useCallback((path: string) => {
    setExpanded((current) => ({ ...current, [path]: !current[path] }));
  }, []);

  return (
    <nav aria-label="文档导航" className="text-sm">
      <ul className="space-y-0.5">
        {tree.index && tree.path === "" ? (
          <li>
            <TreeLink
              to={docUrlPath({ branch, path: "" })}
              title={tree.index.title}
              active={isActive(location.pathname, branch, tree.index.path, config)}
              depth={0}
              onNavigate={onNavigate}
            />
          </li>
        ) : null}

        {tree.children.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            branch={branch}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            activePath={activePath}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
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
}

function TreeItem({
  node,
  branch,
  depth,
  expanded,
  onToggle,
  activePath,
  onNavigate,
}: TreeItemProps) {
  const { config } = useSite();
  const location = useLocation();
  const isFolder = node.children.length > 0 || Boolean(node.index);
  const open = expanded[node.path] ?? false;

  if (!isFolder) {
    return (
      <li>
        <TreeLink
          to={docUrlPath({ branch, path: stripExtension(node.path) })}
          title={node.title}
          active={isActive(location.pathname, branch, node.path, config)}
          depth={depth}
          onNavigate={onNavigate}
          icon={<FileText className="size-3.5 shrink-0 opacity-50" />}
        />
      </li>
    );
  }

  const clickable = Boolean(node.index);
  const folderHref = clickable
    ? docUrlPath({ branch, path: stripExtension(node.index!.path) })
    : undefined;

  return (
    <li>
      <div className="flex items-center">
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
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[var(--ed-text-muted)] transition-colors hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]"
          >
            {open ? (
              <FolderOpen className="size-3.5 shrink-0 opacity-60" />
            ) : (
              <Folder className="size-3.5 shrink-0 opacity-60" />
            )}
            <span className="truncate">{node.title}</span>
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
}: {
  to: string;
  title: string;
  active: boolean;
  depth: number;
  icon?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
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
    </Link>
  );
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
        `/(?:${config.document.index_pages
          .map((name) => stripExtension(name))
          .join("|")})$`,
        "i",
      ),
      "",
    ),
  });
  const base = config.site.base_url === "/" ? "" : config.site.base_url;
  return pathname === `${base}${route}` || pathname === `${base}${route}/`;
}

/** 按 folder_expand_mode 计算初始展开集合 */
export function computeInitialExpansion(
  tree: DocsNode,
  mode: number,
  activePath?: string,
): FolderState {
  const state: FolderState = {};
  const foldersAtDepth = (node: DocsNode, depth: number, out: DocsNode[] = []): DocsNode[] => {
    for (const child of node.children) {
      if (child.children.length > 0) {
        if (depth === 0) out.push(child);
        foldersAtDepth(child, depth + 1, out);
      }
    }
    return out;
  };

  switch (mode) {
    case 1:
      for (const node of tree.children) {
        if (node.children.length > 0) state[node.path] = true;
      }
      break;
    case 2: {
      const walk = (node: DocsNode) => {
        for (const child of node.children) {
          if (child.children.length > 0) {
            state[child.path] = true;
            walk(child);
          }
        }
      };
      walk(tree);
      break;
    }
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
        const walk = (node: DocsNode) => {
          for (const child of node.children) {
            if (child.children.length > 0) {
              state[child.path] = true;
              walk(child);
            }
          }
        };
        state[first.path] = true;
        walk(first);
      }
      break;
    }
    case 5:
    default:
      break;
  }

  void foldersAtDepth;

  if (activePath) {
    Object.assign(state, expandAncestors(tree, activePath));
  }

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
