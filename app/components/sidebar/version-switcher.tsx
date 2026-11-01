import { ChevronDown, GitBranch } from "lucide-react";
import { useSite } from "~/components/providers/config-provider";
import { useState } from "react";
import { siteHref } from "~/lib/content/routes";

export interface VersionSwitcherProps {
  /** 当前版本 */
  current: string;
  className?: string;
}

/** 版本切换下拉（对应 legacy 的侧栏分支选择器） */
export function VersionSwitcher({ current, className }: VersionSwitcherProps) {
  const { config, branches, defaultBranch } = useSite();
  const [open, setOpen] = useState(false);

  if (!config.document.branch_support || branches.length <= 1) return null;

  const currentLabel = branches.find((branch) => branch.name === current)?.label ?? current;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--ed-text-muted)] transition-colors hover:text-[var(--ed-text)]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-1.5">
          <GitBranch className="size-3.5" />
          版本
        </span>
        <span className="flex items-center gap-1 text-[var(--ed-text)]">
          {currentLabel}
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <ul
          className="mt-1 overflow-hidden rounded-lg border border-[var(--ed-border)] bg-[var(--ed-bg-elevated)] py-1 text-xs shadow-lg"
          role="listbox"
        >
          {branches.map((branch) => (
            <li key={branch.name}>
              <a
                href={siteHref(`/docs/${encodeURIComponent(branch.name)}`, config.site.base_url)}
                className={`block px-2.5 py-1.5 transition-colors hover:bg-[var(--ed-bg-subtle)] ${
                  branch.name === current
                    ? "font-medium text-[var(--ed-primary)]"
                    : "text-[var(--ed-text-muted)]"
                }`}
                role="option"
                aria-selected={branch.name === current}
              >
                {branch.label}
                {branch.name === defaultBranch ? (
                  <span className="ml-1.5 text-[10px] opacity-60">默认</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
