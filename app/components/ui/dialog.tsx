/**
 * 通用对话框（v2.0.2）
 *
 * 替代原生 `window.confirm` / `window.prompt` / `<select>`，
 * 保证所有交互都使用站点自身的视觉与键盘行为。
 */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "~/lib/utils";

export interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
  /** 点击遮罩是否关闭 */
  dismissable?: boolean;
  labelledBy?: string;
}

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  className,
  dismissable = true,
  labelledBy,
}: ModalProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={dismissable ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] shadow-2xl",
          className,
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--ed-border)] px-4 py-3">
          <h2 id={labelledBy ?? titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--ed-border)] px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      className="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--ed-border)] px-3 py-1.5 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium text-white",
              danger ? "bg-red-500 hover:bg-red-600" : "bg-[var(--ed-primary)]",
            )}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-[var(--ed-text-muted)]">{message}</div>
    </Modal>
  );
}

export interface PromptDialogProps {
  open: boolean;
  title: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  multiline?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  title,
  label,
  initialValue = "",
  placeholder,
  confirmText = "确定",
  cancelText = "取消",
  multiline,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      className="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--ed-border)] px-3 py-1.5 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {confirmText}
          </button>
        </>
      }
    >
      {label ? (
        <label className="mb-1.5 block text-xs text-[var(--ed-text-muted)]">{label}</label>
      ) : null}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="h-32 w-full resize-y rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ed-primary)]"
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ed-primary)]"
        />
      )}
    </Modal>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectMenuProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
}

/** 自定义下拉选择器（不使用原生 <select>） */
export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  placeholder,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-2.5 py-1.5 text-left text-sm text-[var(--ed-text)] outline-none focus:border-[var(--ed-primary)]"
      >
        <span className="truncate">{selected?.label ?? placeholder ?? value}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-[var(--ed-text-muted)] transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-[80]" role="presentation" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            aria-label={ariaLabel}
            className="absolute left-0 right-0 top-full z-[81] mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-1 text-sm shadow-xl"
          >
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--ed-bg-subtle)]",
                    option.value === value
                      ? "font-medium text-[var(--ed-primary)]"
                      : "text-[var(--ed-text-muted)]",
                  )}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.value === value ? <Check className="size-3.5" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
