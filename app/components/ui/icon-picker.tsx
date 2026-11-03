/**
 * 图标选择器（v2.0.2）
 *
 * 所有需要配置图标的地方（导航、首页卡片、目录、文档）共用：
 *  - 从内置图标库选择
 *  - 或直接输入图标链接 / 图标 id
 * 不使用原生 prompt，全程站内弹窗。
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Globe, Image, Search, Trash2 } from "lucide-react";
import { ICON_CATALOG, isIconUrl } from "~/lib/icons";
import { useI18n } from "~/lib/i18n/provider";
import { Icon } from "./icon";
import { Modal } from "./dialog";
import { cn } from "~/lib/utils";

export interface IconPickerProps {
  open: boolean;
  value?: string;
  title?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** 允许清空 */
  allowClear?: boolean;
}

export function IconPicker({
  open,
  value,
  title,
  onSelect,
  onClose,
  allowClear = true,
}: IconPickerProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"library" | "url">("library");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState(value ?? "");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setUrl(value ?? "");
    setTab(isIconUrl(value) ? "url" : "library");
  }, [open, value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ICON_CATALOG;
    return ICON_CATALOG.filter((item) => item.id.toLowerCase().includes(needle));
  }, [query]);

  const commit = (next: string) => {
    onSelect(next);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={title ?? t("选择图标")}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          {allowClear ? (
            <button
              type="button"
              onClick={() => commit("")}
              className="mr-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ed-text-muted)] hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
              {t("清空")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--ed-border)] px-3 py-1.5 text-xs text-[var(--ed-text-muted)] hover:bg-[var(--ed-bg-subtle)]"
          >
            {t("取消")}
          </button>
          {tab === "url" ? (
            <button
              type="button"
              onClick={() => commit(url.trim())}
              disabled={!url.trim()}
              className="rounded-lg bg-[var(--ed-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {t("应用")}
            </button>
          ) : null}
        </>
      }
    >
      <div className="mb-3 flex gap-1 rounded-lg border border-[var(--ed-border)] p-1">
        <button
          type="button"
          onClick={() => setTab("library")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
            tab === "library"
              ? "bg-[var(--ed-bg-subtle)] font-medium text-[var(--ed-text)]"
              : "text-[var(--ed-text-muted)]",
          )}
        >
          <Image className="size-3.5" />
          {t("图标库")}
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
            tab === "url"
              ? "bg-[var(--ed-bg-subtle)] font-medium text-[var(--ed-text)]"
              : "text-[var(--ed-text-muted)]",
          )}
        >
          <Globe className="size-3.5" />
          {t("图标链接")}
        </button>
      </div>

      {tab === "library" ? (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ed-text-subtle)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("搜索图标…")}
              aria-label={t("搜索图标…")}
              className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[var(--ed-primary)]"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-[var(--ed-text-subtle)]">
              {t("没有匹配的图标")}
            </p>
          ) : (
            <div className="grid max-h-[48vh] grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-7">
              {filtered.map((item) => {
                const active = !isIconUrl(value) && value === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => commit(item.id)}
                    title={item.id}
                    aria-label={item.id}
                    aria-pressed={active}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-lg border transition-colors",
                      active
                        ? "border-[var(--ed-primary)] bg-[var(--ed-primary-soft)] text-[var(--ed-primary)]"
                        : "border-[var(--ed-border)] text-[var(--ed-text-muted)] hover:border-[var(--ed-primary)] hover:text-[var(--ed-primary)]",
                    )}
                  >
                    <Icon name={item.id} className="size-5" />
                    {active ? (
                      <Check className="absolute right-1 top-1 size-2.5" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs text-[var(--ed-text-muted)]" htmlFor="icon-picker-url">
            {t("图标链接")}
          </label>
          <input
            id="icon-picker-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t("输入链接或图标 id")}
            className="w-full rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ed-primary)]"
          />
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--ed-border)] px-3 py-4">
            <span className="grid size-12 place-items-center rounded-lg bg-[var(--ed-bg-subtle)]">
              {url.trim() ? (
                <Icon name={url.trim()} className="size-7" />
              ) : (
                <Image className="size-5 text-[var(--ed-text-subtle)]" />
              )}
            </span>
            <div className="min-w-0 text-xs text-[var(--ed-text-muted)]">
              <p className="font-medium">{t("图标预览")}</p>
              <p className="mt-0.5 truncate">{url || "—"}</p>
            </div>
          </div>
          <p className="text-[11px] text-[var(--ed-text-subtle)]">
            {t("支持 http(s)://、/assets/... 或图标 id。")}
          </p>
        </div>
      )}
    </Modal>
  );
}

export interface IconFieldProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  title?: string;
}

/** 表单里的图标字段：预览 + 打开图标库 */
export function IconField({ value, onChange, label, title }: IconFieldProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div>
      {label ? (
        <span className="mb-1 block text-xs text-[var(--ed-text-muted)]">{label}</span>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={title ?? t("选择图标")}
          aria-label={title ?? t("选择图标")}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] text-[var(--ed-text-muted)] transition-colors hover:border-[var(--ed-primary)] hover:text-[var(--ed-primary)]"
        >
          {value ? <Icon name={value} className="size-4.5" /> : <Image className="size-4" />}
        </button>
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("输入链接或图标 id")}
          className="min-w-0 flex-1 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--ed-primary)]"
        />
      </div>

      <IconPicker
        open={open}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        title={title}
      />
    </div>
  );
}
