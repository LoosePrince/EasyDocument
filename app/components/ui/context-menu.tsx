import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  ExternalLink,
  FilePlus2,
  FolderPlus,
  Link2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** 分组分隔线（在此项之前画一条线） */
  separated?: boolean;
  shortcut?: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  title?: string;
}

/** 通用右键菜单（Portal 渲染，自动避让视口边缘） */
export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!state) return;
    const node = ref.current;
    const width = node?.offsetWidth ?? 220;
    const height = node?.offsetHeight ?? 240;
    const left = Math.min(state.x, window.innerWidth - width - 8);
    const top = Math.min(state.y, window.innerHeight - height - 8);
    setPosition({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    // 延迟到下一帧再注册：
    // 打开菜单的 contextmenu 事件此刻仍在冒泡，若同步挂到 window 上，
    // 该事件冒泡到 window 时会立即触发 close，菜单一闪而过。
    const frame = requestAnimationFrame(() => {
      window.addEventListener("click", close);
      window.addEventListener("contextmenu", close);
      window.addEventListener("resize", close);
      window.addEventListener("scroll", close, true);
      window.addEventListener("keydown", onKey);
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const items = state.items.filter((item) => !item.hidden);
  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-context-menu=""
      className="fixed z-[100] min-w-52 overflow-hidden rounded-xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-1 text-[13px] shadow-xl"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
    >
      {state.title ? (
        <p className="truncate px-3 py-1.5 text-[11px] font-medium text-[var(--ed-text-subtle)]">
          {state.title}
        </p>
      ) : null}

      {items.map((item) => (
        <div key={item.id}>
          {item.separated ? (
            <div className="my-1 border-t border-[var(--ed-border)]" role="separator" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors disabled:opacity-40",
              item.danger
                ? "text-red-500 hover:bg-red-500/10"
                : "text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)] hover:text-[var(--ed-text)]",
            )}
          >
            <span className="grid size-4 place-items-center opacity-70">{item.icon}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut ? (
              <span className="font-mono text-[10px] text-[var(--ed-text-subtle)]">
                {item.shortcut}
              </span>
            ) : null}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** 右键菜单标准图标集 */
export const menuIcons = {
  open: <ExternalLink className="size-3.5" />,
  copy: <Copy className="size-3.5" />,
  markdown: <Link2 className="size-3.5" />,
  newDoc: <FilePlus2 className="size-3.5" />,
  newFolder: <FolderPlus className="size-3.5" />,
  rename: <Pencil className="size-3.5" />,
  delete: <Trash2 className="size-3.5" />,
  revert: <RotateCcw className="size-3.5" />,
};

/** 复制文本并给出轻提示 */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 轻量 toast（右下角，2 秒自动消失） */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const show = (text: string) => {
    setMessage(text);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2000);
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const node = message
    ? createPortal(
        <div className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-lg bg-[var(--ed-text)] px-3.5 py-2 text-xs text-[var(--ed-bg-elevated)] shadow-lg">
          {message}
        </div>,
        document.body,
      )
    : null;

  return { show, node, message };
}
